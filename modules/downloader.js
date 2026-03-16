const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const os = require('os');

const TEMP_DIR = os.tmpdir();

/**
 * Find the yt-dlp executable path.
 * Checks: PATH, WinGet package store, common local dirs.
 */
function findYtDlp() {
  // 1. Try plain name (works if it's on PATH)
  try {
    execSync('yt-dlp --version', { stdio: 'ignore' });
    return 'yt-dlp';
  } catch {}

  // 2. Search WinGet package directory (Windows)
  const wingetBase = path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages');
  if (fs.existsSync(wingetBase)) {
    const entries = walkDir(wingetBase, 'yt-dlp.exe');
    if (entries.length > 0) return entries[0];
  }

  // 3. Common manual install locations
  const candidates = [
    path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'yt-dlp', 'yt-dlp.exe'),
    'C:\\yt-dlp\\yt-dlp.exe',
    path.join(__dirname, '..', 'yt-dlp.exe'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }

  return null;
}

/** Recursive search for a filename in a directory (max depth 4) */
function walkDir(dir, target, depth = 0) {
  if (depth > 4) return [];
  let found = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isFile() && e.name.toLowerCase() === target.toLowerCase()) {
        found.push(full);
      } else if (e.isDirectory()) {
        found = found.concat(walkDir(full, target, depth + 1));
      }
    }
  } catch {}
  return found;
}

// Resolve once at startup
const YT_DLP_PATH = findYtDlp();
console.log(`[Unreel] yt-dlp resolved to: ${YT_DLP_PATH || 'NOT FOUND'}`);

/**
 * Download a video from a URL using yt-dlp
 * Supports YouTube Shorts, Instagram Reels, TikTok public videos
 * @param {string} url - Video URL
 * @returns {Promise<{videoPath: string, title: string, platform: string}>}
 */
async function downloadVideo(url) {
  if (!YT_DLP_PATH) {
    throw new Error(
      'yt-dlp not found. Please install it: https://github.com/yt-dlp/yt-dlp/releases\n' +
      'On Windows run: winget install yt-dlp.yt-dlp'
    );
  }

  const outputId = uuidv4();
  // Use %(ext)s so yt-dlp fills in the real extension
  const outputTemplate = path.join(TEMP_DIR, `unreel_${outputId}.%(ext)s`);

  const platform = detectPlatform(url);

  return new Promise((resolve, reject) => {
    const args = [
      url,
      '-o', outputTemplate,
      // Prefer mp4; fall back to any best available format
      '--format', 'bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best',
      '--merge-output-format', 'mp4',
      '--max-filesize', '50M',
      '--no-playlist',
      '--no-simulate',   // force download even when --print is used (newer yt-dlp)
      '--quiet',
      '--no-warnings',
      '--print', 'title', // print title to stdout after download
    ];

    // For Instagram: hint the extractor to use web client
    if (platform === 'Instagram') {
      args.push('--extractor-args', 'instagram:player_client=web');
    }

    const ytdlp = spawn(YT_DLP_PATH, args);

    let title = 'Unknown Video';
    let stdout = '';
    let stderr = '';

    ytdlp.stdout.on('data', data => { stdout += data.toString(); });
    ytdlp.stderr.on('data', data => { stderr += data.toString(); });

    ytdlp.on('close', code => {
      // Scan temp dir for any file that matches our UUID prefix
      const downloaded = fs.readdirSync(TEMP_DIR)
        .find(f => f.startsWith(`unreel_${outputId}`));

      if (code === 0 && downloaded) {
        title = stdout.trim().split('\n')[0] || 'Unknown Video';
        const videoPath = path.join(TEMP_DIR, downloaded);
        console.log(`[Unreel] Downloaded file: ${videoPath}`);
        resolve({ videoPath, title, platform });
      } else {
        // Clean up any partial files
        fs.readdirSync(TEMP_DIR)
          .filter(f => f.startsWith(`unreel_${outputId}`))
          .forEach(f => { try { fs.unlinkSync(path.join(TEMP_DIR, f)); } catch {} });
        reject(new Error(
          `yt-dlp failed (code ${code}). Platform: ${platform}.\n${stderr.slice(0, 500)}`
        ));
      }
    });

    ytdlp.on('error', err => {
      reject(new Error(
        `Failed to spawn yt-dlp (${YT_DLP_PATH}): ${err.message}`
      ));
    });

    // Timeout after 60 seconds
    setTimeout(() => {
      ytdlp.kill();
      reject(new Error('Download timed out after 60 seconds.'));
    }, 60000);
  });
}

function detectPlatform(url) {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube';
  if (url.includes('instagram.com')) return 'Instagram';
  if (url.includes('tiktok.com')) return 'TikTok';
  if (url.includes('twitter.com') || url.includes('x.com')) return 'Twitter/X';
  if (url.includes('facebook.com')) return 'Facebook';
  return 'Unknown';
}

module.exports = { downloadVideo, detectPlatform };
