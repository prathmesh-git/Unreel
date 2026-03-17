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
router.post('/url', async (req, res) => {
  const { url } = req.body;

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: 'Please provide a valid video URL.' });
  }

  let videoPath = null;
  try {
    console.log(`[Unreel] Downloading: ${url}`);
    const { videoPath: vPath, title, platform } = await downloadVideo(url);
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
    const [factCheckResults, biasResult] = await Promise.all([
      factCheckAll(claims),
      analyzeBias(fullContent, claims),
    ]);

    const analysisData = {
      videoInfo: { title, platform, url },
      transcript,
      onScreenText: onScreenText || null,
      factChecks: factCheckResults,
      bias: biasResult,
      analyzedAt: new Date().toISOString(),
    };

    const savedId = await persistResult(analysisData, 'url');
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

// ─── POST /api/analyze/upload ─────────────────────────────────────────────────
router.post('/upload', upload.single('video'), async (req, res) => {
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
    const [factCheckResults, biasResult] = await Promise.all([
      factCheckAll(claims),
      analyzeBias(fullContent, claims),
    ]);

    const analysisData = {
      videoInfo: {
        title: req.file.originalname || 'Uploaded Video',
        platform: 'Upload',
        url: null,
      },
      transcript,
      onScreenText: onScreenText || null,
      factChecks: factCheckResults,
      bias: biasResult,
      analyzedAt: new Date().toISOString(),
    };

    const savedId = await persistResult(analysisData, 'upload');
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

async function persistResult(data, sourceType) {
  if (mongoose.connection.readyState !== 1) return null;
  try {
    const doc = await AnalysisResult.create({
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

module.exports = router;
