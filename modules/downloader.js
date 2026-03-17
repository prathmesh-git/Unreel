const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const os = require('os');

const TEMP_DIR = os.tmpdir();
const INSTAGRAM_BROWSER_CANDIDATES = ['chrome', 'edge', 'firefox'];
const BROWSER_COOKIE_LABEL_TOKEN = 'cookies';
let resolvedInstagramCookiesFile = null;

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
const YT_DLP_VERSION = getYtDlpVersion();
if (YT_DLP_VERSION) {
  console.log(`[Unreel] yt-dlp version: ${YT_DLP_VERSION}`);
}

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

  const attempts = buildAttemptArgs(url, outputTemplate, platform);
  let lastError = '';
  let bestNonCookieError = '';

  for (const attempt of attempts) {
    try {
      const result = await runYtDlp(attempt.args, outputId, platform);
      console.log(`[Unreel] Download strategy succeeded: ${attempt.label}`);
      return result;
    } catch (err) {
      lastError = err.message || 'Unknown yt-dlp error';
      if (!attempt.label.includes(BROWSER_COOKIE_LABEL_TOKEN) && !bestNonCookieError) {
        bestNonCookieError = lastError;
      }
      console.warn(`[Unreel] Download strategy failed (${attempt.label}): ${lastError.split('\n')[0]}`);
    }
  }

  cleanupByOutputId(outputId);
  const errorForUser = (bestNonCookieError || lastError).slice(0, 700);
  throw new Error(`yt-dlp failed. Platform: ${platform}.\n${errorForUser}`);
}

function buildAttemptArgs(url, outputTemplate, platform) {
  const baseArgs = buildBaseArgs(url, outputTemplate);

  const attempts = [{
    label: 'default',
    args: [...baseArgs],
  }];

  if (platform === 'YouTube') {
    attempts.unshift({
      label: 'youtube-web-android',
      args: [
        ...buildBaseArgs(url, outputTemplate),
        '--extractor-args', 'youtube:player_client=web,android',
      ],
    });
  }

  if (platform === 'Instagram') {
    const normalizedUrls = buildInstagramUrlVariants(url);
    const extractorModes = [
      { key: 'web-client', value: 'instagram:player_client=web' },
      { key: 'api-v1', value: 'instagram:api_version=v1' },
      { key: 'web-client-api-v1', value: 'instagram:player_client=web;api_version=v1' },
    ];

    for (const candidateUrl of normalizedUrls) {
      for (const mode of extractorModes) {
        const instagramArgs = [
          ...buildBaseArgs(candidateUrl, outputTemplate),
          '--extractor-args', mode.value,
          '--referer', 'https://www.instagram.com/',
          '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        ];
        attempts.unshift({ label: `instagram-${mode.key}:${candidateUrl}`, args: instagramArgs });
      }
    }

    const cookiesFile = getInstagramCookiesFile();
    if (cookiesFile && fs.existsSync(cookiesFile)) {
      const cookieUrl = normalizedUrls[0] || url;
      attempts.push({
        label: 'instagram-cookies-file',
        args: [
          ...buildBaseArgs(cookieUrl, outputTemplate),
          '--extractor-args', 'instagram:player_client=web;api_version=v1',
          '--referer', 'https://www.instagram.com/',
          '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          '--cookies', cookiesFile,
        ],
      });
    }

    if (canUseBrowserCookies()) {
      const cookieUrl = normalizedUrls[0] || url;
      for (const browser of INSTAGRAM_BROWSER_CANDIDATES) {
        attempts.push({
          label: `instagram-cookies-from-${browser}`,
          args: [
            ...buildBaseArgs(cookieUrl, outputTemplate),
            '--extractor-args', 'instagram:player_client=web;api_version=v1',
            '--referer', 'https://www.instagram.com/',
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            '--cookies-from-browser', browser,
          ],
        });
      }
    }
  }

  return attempts;
}

function canUseBrowserCookies() {
  if (process.env.ENABLE_BROWSER_COOKIES === 'true') return true;
  if (process.env.ENABLE_BROWSER_COOKIES === 'false') return false;

  // Default: allow in local Windows/dev, disable in hosted Linux containers.
  if (process.env.RENDER || process.env.RAILWAY_ENVIRONMENT) return false;
  return process.platform === 'win32';
}

function buildBaseArgs(targetUrl, outputTemplate) {
  return [
    targetUrl,
    '-o', outputTemplate,
    // Prefer mp4; fall back to any best available format.
    '--format', 'bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best',
    '--merge-output-format', 'mp4',
    '--max-filesize', '50M',
    '--no-playlist',
    '--no-simulate',
    '--print', 'title',
    '--no-warnings',
    '--retries', '3',
    '--fragment-retries', '3',
    '--extractor-retries', '3',
    '--socket-timeout', '20',
  ];
}

function buildInstagramUrlVariants(rawUrl) {
  const variants = [];
  const pushUnique = (value) => {
    if (value && !variants.includes(value)) variants.push(value);
  };

  pushUnique(rawUrl);

  try {
    const parsed = new URL(rawUrl);
    parsed.hash = '';
    parsed.search = '';

    if (parsed.hostname === 'm.instagram.com') {
      parsed.hostname = 'www.instagram.com';
    }

    // Convert some mobile share-style paths to canonical reel paths.
    parsed.pathname = parsed.pathname.replace(/^\/share\/reel\//, '/reel/');

    if (!parsed.pathname.endsWith('/')) {
      parsed.pathname = `${parsed.pathname}/`;
    }

    pushUnique(parsed.toString());

    const noWww = new URL(parsed.toString());
    noWww.hostname = 'instagram.com';
    pushUnique(noWww.toString());
  } catch {}

  return variants;
}

function getInstagramCookiesFile() {
  if (resolvedInstagramCookiesFile) return resolvedInstagramCookiesFile;

  const explicitFile = process.env.INSTAGRAM_COOKIES_FILE;
  if (explicitFile && fs.existsSync(explicitFile)) {
    resolvedInstagramCookiesFile = explicitFile;
    return resolvedInstagramCookiesFile;
  }

  const base64Cookies = process.env.INSTAGRAM_COOKIES_B64;
  if (!base64Cookies) return null;

  try {
    const cookieText = Buffer.from(base64Cookies, 'base64').toString('utf8').trim();
    if (!cookieText) return null;

    const cookiePath = path.join(TEMP_DIR, 'unreel_instagram_cookies.txt');
    fs.writeFileSync(cookiePath, cookieText, 'utf8');
    resolvedInstagramCookiesFile = cookiePath;
    return resolvedInstagramCookiesFile;
  } catch (error) {
    console.warn(`[Unreel] Failed to decode INSTAGRAM_COOKIES_B64: ${error.message}`);
    return null;
  }
}

function runYtDlp(args, outputId, platform) {
  return new Promise((resolve, reject) => {
    const ytdlp = spawn(YT_DLP_PATH, args);

    let stdout = '';
    let stderr = '';

    ytdlp.stdout.on('data', data => { stdout += data.toString(); });
    ytdlp.stderr.on('data', data => { stderr += data.toString(); });

    const timer = setTimeout(() => {
      ytdlp.kill();
      reject(new Error('Download timed out after 60 seconds.'));
    }, 60000);

    ytdlp.on('close', code => {
      clearTimeout(timer);
      const downloaded = fs.readdirSync(TEMP_DIR).find(f => f.startsWith(`unreel_${outputId}`));

      if (code === 0 && downloaded) {
        const title = stdout.trim().split('\n')[0] || 'Unknown Video';
        const videoPath = path.join(TEMP_DIR, downloaded);
        console.log(`[Unreel] Downloaded file: ${videoPath}`);
        resolve({ videoPath, title, platform });
        return;
      }

      cleanupByOutputId(outputId);
      reject(new Error(`yt-dlp exited with code ${code}. ${(stderr || stdout).trim().slice(0, 700)}`));
    });

    ytdlp.on('error', err => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn yt-dlp (${YT_DLP_PATH}): ${err.message}`));
    });
  });
}

function cleanupByOutputId(outputId) {
  fs.readdirSync(TEMP_DIR)
    .filter(f => f.startsWith(`unreel_${outputId}`))
    .forEach(f => {
      try {
        fs.unlinkSync(path.join(TEMP_DIR, f));
      } catch {}
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

function getYtDlpVersion() {
  if (!YT_DLP_PATH) return null;
  try {
    return execSync(`${YT_DLP_PATH} --version`, { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function getDownloaderDiagnostics() {
  return {
    ytDlpPath: YT_DLP_PATH,
    ytDlpVersion: YT_DLP_VERSION,
    instagramCookiesConfigured: !!getInstagramCookiesFile(),
    browserCookiesEnabled: canUseBrowserCookies(),
    platform: process.platform,
    render: !!process.env.RENDER,
    railway: !!process.env.RAILWAY_ENVIRONMENT,
  };
}

module.exports = { downloadVideo, detectPlatform, getDownloaderDiagnostics };
