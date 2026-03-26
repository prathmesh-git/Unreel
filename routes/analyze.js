const express = require('express');
const multer = require('multer');
const fs = require('fs');
const os = require('os');
const mongoose = require('mongoose');

const { downloadVideo, detectPlatform } = require('../modules/downloader');
const { transcribeVideo } = require('../modules/transcriber');
const { extractClaims } = require('../modules/claimExtractor');
const { factCheckAll } = require('../modules/factChecker');
const { analyzeBias } = require('../modules/biasAnalyzer');
const { extractKeyframes } = require('../modules/audioExtractor');
const { extractOnScreenText } = require('../modules/ocrExtractor');
const AnalysisResult = require('../models/AnalysisResult');
const User = require('../models/User');
const { optionalAuth } = require('../middleware/authMiddleware');
const { sendAnalysisResultEmail } = require('../modules/mailer');

const router = express.Router();

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video/audio files are allowed'));
    }
  },
});

// ─── POST /api/analyze/url ────────────────────────────────────────────────────
router.post('/url', optionalAuth, async (req, res) => {
  const { url } = req.body;

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: 'Please provide a valid video URL.' });
  }

  let videoPath = null;
  try {
    console.log(`[Unreel] Downloading: ${url}`);
    const { videoPath: vPath, title, platform, publishedAt } = await downloadVideo(url);
    videoPath = vPath;
    console.log(`[Unreel] Downloaded: ${title} (${platform})`);

    console.log('[Unreel] Transcribing + extracting on-screen text...');
    const [transcript, keyframes] = await Promise.all([
      transcribeVideo(videoPath),
      extractKeyframes(videoPath, 6),
    ]);
    console.log(`[Unreel] Transcript (${transcript.length} chars)`);

    const onScreenText = await extractOnScreenText(keyframes);
    const fullContent = [transcript, onScreenText].filter(Boolean).join('\n\n[ON-SCREEN TEXT]:\n');

    console.log('[Unreel] Extracting claims...');
    const claims = await extractClaims(fullContent);

    console.log('[Unreel] Fact-checking and bias analysis...');
    const analyzedAt = new Date().toISOString();
    const inferredDate = inferContentDate(fullContent);
    const contentDate = publishedAt || inferredDate || null;
    const [factCheckResults, biasResult] = await Promise.all([
      factCheckAll(claims, { contentDate, analyzedAt, sourceType: 'url', platform }),
      analyzeBias(fullContent, claims),
    ]);

    const analysisData = {
      videoInfo: { title, platform, url, contentDate },
      transcript,
      onScreenText: onScreenText || null,
      factChecks: factCheckResults,
      bias: biasResult,
      analyzedAt,
    };

    const savedId = await persistResult(analysisData, 'url', req.user?._id);
    sendAnalysisEmailIfEnabled(req.user?._id, analysisData, savedId).catch((err) => {
      console.warn('[Unreel] Analysis email skipped/failed:', err.message);
    });
    res.json(toApiResponse(analysisData, savedId));
  } catch (error) {
    console.error('[Unreel] Error:', error.message);

    if (error.message.includes('yt-dlp not found')) {
      return res.status(500).json({
        error: 'yt-dlp is not installed. Please install it from https://github.com/yt-dlp/yt-dlp/releases',
        canUpload: true,
      });
    }
    if (error.message.includes('yt-dlp failed')) {
      return res.status(422).json({
        error: `Could not download this video. ${getDownloadHint(url, error.message)}`,
        canUpload: true,
        platform: detectPlatform(url),
      });
    }

    res.status(500).json({ error: error.message });
  } finally {
    if (videoPath && fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
  }
});

// ─── POST /api/analyze/text ───────────────────────────────────────────────────
router.post('/text', optionalAuth, async (req, res) => {
  const { text } = req.body;
  if (!text || text.trim().length < 20) {
    return res.status(400).json({ error: 'Please provide at least 20 characters of text to analyze.' });
  }
  const transcript = text.trim().slice(0, 50000);
  try {
    console.log('[Unreel] Analyzing pasted transcript...');
    const claims = await extractClaims(transcript);
    const analyzedAt = new Date().toISOString();
    const contentDate = inferContentDate(transcript);
    const [factCheckResults, biasResult] = await Promise.all([
      factCheckAll(claims, { contentDate, analyzedAt, sourceType: 'text', platform: 'Text' }),
      analyzeBias(transcript, claims),
    ]);
    const analysisData = {
      videoInfo: { title: 'Pasted Transcript', platform: 'Text', url: null, contentDate },
      transcript,
      onScreenText: null,
      factChecks: factCheckResults,
      bias: biasResult,
      analyzedAt,
    };
    const savedId = await persistResult(analysisData, 'text', req.user?._id);
    sendAnalysisEmailIfEnabled(req.user?._id, analysisData, savedId).catch((err) => {
      console.warn('[Unreel] Analysis email skipped/failed:', err.message);
    });
    res.json(toApiResponse(analysisData, savedId));
  } catch (error) {
    console.error('[Unreel] Text analysis error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/analyze/upload ─────────────────────────────────────────────────
router.post('/upload', optionalAuth, upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video file uploaded.' });
  }

  const videoPath = req.file.path;
  try {
    console.log('[Unreel] Processing uploaded file...');
    const [transcript, keyframes] = await Promise.all([
      transcribeVideo(videoPath),
      extractKeyframes(videoPath, 6),
    ]);
    const onScreenText = await extractOnScreenText(keyframes);
    const fullContent = [transcript, onScreenText].filter(Boolean).join('\n\n[ON-SCREEN TEXT]:\n');
    const claims = await extractClaims(fullContent);
    const analyzedAt = new Date().toISOString();
    const contentDate = inferContentDate(fullContent);
    const [factCheckResults, biasResult] = await Promise.all([
      factCheckAll(claims, { contentDate, analyzedAt, sourceType: 'upload', platform: 'Upload' }),
      analyzeBias(fullContent, claims),
    ]);

    const analysisData = {
      videoInfo: {
        title: req.file.originalname || 'Uploaded Video',
        platform: 'Upload',
        url: null,
        contentDate,
      },
      transcript,
      onScreenText: onScreenText || null,
      factChecks: factCheckResults,
      bias: biasResult,
      analyzedAt,
    };

    const savedId = await persistResult(analysisData, 'upload', req.user?._id);
    sendAnalysisEmailIfEnabled(req.user?._id, analysisData, savedId).catch((err) => {
      console.warn('[Unreel] Analysis email skipped/failed:', err.message);
    });
    res.json(toApiResponse(analysisData, savedId));
  } catch (error) {
    console.error('[Unreel] Upload error:', error.message);
    res.status(500).json({ error: error.message });
  } finally {
    if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function getDownloadHint(url, rawError = '') {
  const platform = detectPlatform(url);
  const details = rawError.toLowerCase();

  if (platform === 'YouTube') {
    if (details.includes('sign in to confirm') || details.includes('bot') || details.includes('429') || details.includes('too many requests')) {
      return 'YouTube is blocking or rate-limiting this cloud download request right now. Please retry later or upload the file directly.';
    }
    return 'YouTube could not be downloaded from this server right now. Please retry later or upload the video file directly.';
  }

  if (details.includes('login required') || details.includes('private')) {
    return 'This post appears private/login-protected, or Instagram is blocking unauthenticated cloud requests for this link. Open a fully public reel URL and try again, or upload the file directly.';
  }

  if (platform === 'Instagram' && (details.includes('cookies-from-browser') || details.includes('cookies'))) {
    return 'Instagram may require an active logged-in browser session. Log in to Instagram in Chrome/Edge on this machine and try again.';
  }

  if (details.includes('requested format is not available')) {
    return 'The reel format is unavailable right now. Please retry in a moment or upload the file directly.';
  }

  if (details.includes('sign in to confirm') || details.includes('bot') || details.includes('429') || details.includes('too many requests')) {
    return 'This platform is blocking or rate-limiting automated cloud downloads for this link right now. Please retry later or upload the file directly.';
  }

  if (platform === 'Instagram') {
    return 'Instagram blocks some reels depending on account visibility and anti-bot checks. Try again after logging in to Instagram in your browser, or upload the file directly.';
  }
  if (platform === 'YouTube') {
    return 'YouTube may be blocking or rate-limiting this cloud download request. Please try again later or upload the video file directly.';
  }
  if (platform === 'TikTok') {
    return 'TikTok may restrict downloads. Please try uploading the video file instead.';
  }
  return 'Please try uploading the video file instead.';
}

function inferContentDate(text = '') {
  const sample = String(text).slice(0, 5000);

  const iso = sample.match(/\b(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/);
  if (iso) return iso[0];

  const slash = sample.match(/\b(0?[1-9]|1[0-2])[\/-](0?[1-9]|[12]\d|3[01])[\/-](20\d{2})\b/);
  if (slash) {
    const mm = slash[1].padStart(2, '0');
    const dd = slash[2].padStart(2, '0');
    const yyyy = slash[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  const monthMatch = sample.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s+(20\d{2})\b/i);
  if (monthMatch) {
    const months = {
      january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
      july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
    };
    const month = months[monthMatch[1].toLowerCase()];
    const day = monthMatch[2].padStart(2, '0');
    const year = monthMatch[3];
    return `${year}-${month}-${day}`;
  }

  return null;
}

function toApiResponse(data, resultId) {
  const transcript = data.transcript || '';
  return {
    success: true,
    resultId,
    videoInfo: data.videoInfo,
    transcript: transcript.slice(0, 1000) + (transcript.length > 1000 ? '...' : ''),
    onScreenText: data.onScreenText,
    factChecks: data.factChecks,
    bias: data.bias,
    analyzedAt: data.analyzedAt,
  };
}

async function persistResult(data, sourceType, userId = null) {
  if (mongoose.connection.readyState !== 1) return null;
  try {
    const doc = await AnalysisResult.create({
      userId: userId || null,
      videoInfo: data.videoInfo,
      transcript: data.transcript,
      onScreenText: data.onScreenText,
      factChecks: data.factChecks,
      bias: data.bias,
      sourceType,
      analyzedAt: data.analyzedAt,
    });
    return doc._id.toString();
  } catch (err) {
    console.error('[Unreel] Failed to save to MongoDB:', err.message);
    return null;
  }
}

async function sendAnalysisEmailIfEnabled(userId, analysisData, resultId) {
  if (!userId) return;

  const user = await User.findById(userId).select('name email preferences.emailAnalysisResults');
  if (!user || !user.email) return;

  const enabled = user?.preferences?.emailAnalysisResults !== false;
  if (!enabled) return;

  await sendAnalysisResultEmail({
    name: user.name,
    email: user.email,
    analysisData,
    resultId,
  });
}

module.exports = router;
