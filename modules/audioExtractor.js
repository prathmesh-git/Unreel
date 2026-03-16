const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

/**
 * Find ffmpeg executable — checks PATH, yt-dlp WinGet bundle, common locations
 */
function findFfmpeg() {
  // 1. Check PATH
  try { execSync('ffmpeg -version', { stdio: 'ignore' }); return 'ffmpeg'; } catch {}

  // 2. Check yt-dlp WinGet bundle (yt-dlp ships with ffmpeg on Windows)
  const wingetBase = path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages');
  if (fs.existsSync(wingetBase)) {
    const found = walkDir(wingetBase, 'ffmpeg.exe');
    if (found.length > 0) return found[0];
  }

  // 3. Common manual install paths
  const candidates = [
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
    path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'ffmpeg', 'bin', 'ffmpeg.exe'),
  ];
  for (const c of candidates) { if (fs.existsSync(c)) return c; }

  return null;
}

function walkDir(dir, target, depth = 0) {
  if (depth > 5) return [];
  let found = [];
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isFile() && e.name.toLowerCase() === target.toLowerCase()) found.push(full);
      else if (e.isDirectory()) found = found.concat(walkDir(full, target, depth + 1));
    }
  } catch {}
  return found;
}

const FFMPEG_PATH = findFfmpeg();
console.log(`[Unreel] ffmpeg resolved to: ${FFMPEG_PATH || 'NOT FOUND — audio compression unavailable'}`);

/**
 * Extract and compress audio from a video file to MP3
 * Input can be any video/audio format. Output is a small mono MP3.
 * @param {string} inputPath
 * @returns {Promise<string>} — path to output MP3 file
 */
function extractAudio(inputPath) {
  const outputPath = inputPath.replace(/\.[^.]+$/, '_audio.mp3');

  return new Promise((resolve, reject) => {
    if (!FFMPEG_PATH) {
      // No ffmpeg — return original file and hope it fits under Groq limit
      console.log('[Unreel] ffmpeg not found, sending original file to Groq');
      return resolve(inputPath);
    }

    const args = [
      '-y',                    // overwrite output
      '-i', inputPath,         // input file
      '-vn',                   // no video
      '-ar', '16000',          // 16kHz sample rate (Whisper optimal)
      '-ac', '1',              // mono
      '-b:a', '32k',           // 32kbps bitrate — very small file
      '-f', 'mp3',             // output format
      outputPath,
    ];

    const ff = spawn(FFMPEG_PATH, args);
    let stderr = '';
    ff.stderr.on('data', d => { stderr += d.toString(); });
    ff.on('close', code => {
      if (code === 0 && fs.existsSync(outputPath)) {
        const sizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);
        console.log(`[Unreel] Audio extracted: ${outputPath} (${sizeMB} MB)`);
        resolve(outputPath);
      } else {
        console.warn('[Unreel] ffmpeg audio extraction failed, using original file');
        resolve(inputPath); // fallback to original
      }
    });
    ff.on('error', () => resolve(inputPath)); // fallback
  });
}

/**
 * Extract keyframes from video as base64 JPEG strings
 * @param {string} videoPath
 * @param {number} maxFrames
 * @returns {Promise<string[]>} — array of base64 JPEG strings
 */
function extractKeyframes(videoPath, maxFrames = 6) {
  return new Promise((resolve) => {
    if (!FFMPEG_PATH) return resolve([]);

    const tmpDir = os.tmpdir();
    const runId = `unreel_ocr_${Date.now()}`;
    const framePattern = path.join(tmpDir, `${runId}_%03d.jpg`);

    const args = [
      '-y',
      '-i', videoPath,
      '-vf', 'fps=1/3,scale=640:-1',   // 1 frame per 3s, 640px wide
      '-frames:v', String(maxFrames),
      '-q:v', '5',
      framePattern,
    ];

    const ff = spawn(FFMPEG_PATH, args);
    ff.on('close', () => {
      try {
        const frameFiles = fs.readdirSync(tmpDir)
          .filter(f => f.startsWith(runId) && f.endsWith('.jpg'))
          .sort()
          .slice(0, maxFrames)
          .map(f => path.join(tmpDir, f));

        const base64Frames = frameFiles.map(f => {
          const data = fs.readFileSync(f).toString('base64');
          try { fs.unlinkSync(f); } catch {}
          return data;
        });

        console.log(`[Unreel] Extracted ${base64Frames.length} keyframes for OCR`);
        resolve(base64Frames);
      } catch {
        resolve([]);
      }
    });
    ff.on('error', () => resolve([]));
  });
}

module.exports = { extractAudio, extractKeyframes, FFMPEG_PATH };
