const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');
const { extractAudio } = require('./audioExtractor');

/**
 * Transcribe audio/video using Groq Whisper (free).
 * Compresses audio first to stay under Groq's 25MB limit.
 * @param {string} videoPath
 * @returns {Promise<string>}
 */
async function transcribeVideo(videoPath) {
  if (!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY) {
    throw new Error('No transcription API key. Add GROQ_API_KEY to .env — free at https://console.groq.com');
  }

  // Compress to small MP3 first (solves "Entity Too Large" for big Instagram/TikTok videos)
  let audioPath = videoPath;
  let didConvert = false;
  try {
    audioPath = await extractAudio(videoPath);
    didConvert = audioPath !== videoPath;
  } catch (e) {
    console.warn('[Unreel] Audio compression skipped:', e.message);
  }

  try {
    if (process.env.GROQ_API_KEY) {
      return await transcribeWithGroq(audioPath);
    }
    return await transcribeWithOpenAI(audioPath);
  } finally {
    // Clean up the converted audio file (not the original — downloader handles that)
    if (didConvert && fs.existsSync(audioPath)) {
      try { fs.unlinkSync(audioPath); } catch {}
    }
  }
}

/** Groq Whisper — FREE, ~28,800 sec/day limit */
async function transcribeWithGroq(audioPath) {
  const ext = path.extname(audioPath).slice(1) || 'mp3';
  const mimeMap = { mp3: 'audio/mpeg', mp4: 'video/mp4', m4a: 'audio/mp4', wav: 'audio/wav', webm: 'audio/webm' };
  const mimeType = mimeMap[ext] || 'audio/mpeg';

  const form = new FormData();
  form.append('file', fs.createReadStream(audioPath), {
    filename: `audio.${ext}`,
    contentType: mimeType,
  });
  form.append('model', 'whisper-large-v3-turbo');
  form.append('response_format', 'json');

  const response = await axios.post(
    'https://api.groq.com/openai/v1/audio/transcriptions',
    form,
    {
      headers: { ...form.getHeaders(), Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 120000,
    }
  );
  const text = response.data.text || '';
  console.log(`[Unreel] Groq transcript (${text.length} chars)`);
  return text;
}

/** OpenAI Whisper — fallback, requires billing */
async function transcribeWithOpenAI(audioPath) {
  const form = new FormData();
  form.append('file', fs.createReadStream(audioPath), {
    filename: path.basename(audioPath),
    contentType: 'audio/mpeg',
  });
  form.append('model', 'whisper-1');
  form.append('response_format', 'json');

  const response = await axios.post(
    'https://api.openai.com/v1/audio/transcriptions',
    form,
    {
      headers: { ...form.getHeaders(), Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 120000,
    }
  );
  return response.data.text || '';
}

module.exports = { transcribeVideo };
