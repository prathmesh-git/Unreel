const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const os = require('os');

const TEMP_DIR = os.tmpdir();
const INSTAGRAM_BROWSER_CANDIDATES = ['chrome', 'edge', 'firefox'];
const BROWSER_COOKIE_LABEL_TOKEN = 'cookies';
const SUBTITLE_EXTENSIONS = new Set(['.vtt', '.srt', '.ass', '.ssa', '.ttml', '.sbv', '.lrc']);
const MEDIA_EXTENSIONS = new Set(['.mp4', '.mkv', '.webm', '.mov', '.m4v', '.avi', '.flv', '.wmv', '.ts', '.m4a', '.mp3', '.mka', '.opus']);
let resolvedInstagramCookiesFile = null;
let resolvedYtDlpCookiesFile = null;

// Timeouts per platform (ms)
const TIMEOUT_YOUTUBE = 180_000; // 3 minutes — YouTube can be slow with bot detection
const TIMEOUT_DEFAULT = 120_000; // 2 minutes

// Inter-attempt delay to avoid triggering rate limits (ms)
const RETRY_DELAY_MS = 800;
const RETRY_DELAY_SAME_HOST_MS = 1500;

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
 * Sleep utility for inter-attempt delays.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a dedicated temp subdirectory for a download to avoid scanning the
 * entire system temp folder. Returns the directory path.
 */
function createDownloadDir(outputId) {
  const dir = path.join(TEMP_DIR, `unreel_${outputId}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Download a video from a URL using yt-dlp
 * Supports YouTube Shorts, Instagram Reels, TikTok public videos
 * @param {string} url - Video URL
 * @returns {Promise<{videoPath: string, title: string, platform: string, publishedAt: string | null}>}
 */
async function downloadVideo(url) {
  if (!YT_DLP_PATH) {
    throw new Error(
      'yt-dlp not found. Please install it: https://github.com/yt-dlp/yt-dlp/releases\n' +
      'On Windows run: winget install yt-dlp.yt-dlp'
    );
  }

  // Verify yt-dlp is still accessible (guards against binary disappearing mid-session)
  try {
    execSync(`"${YT_DLP_PATH}" --version`, { stdio: 'ignore', timeout: 5000 });
  } catch {
    throw new Error(
      'yt-dlp binary is no longer accessible. It may have been moved or corrupted. ' +
      'Please reinstall: https://github.com/yt-dlp/yt-dlp/releases'
    );
  }

  const outputId = uuidv4();
  const downloadDir = createDownloadDir(outputId);
  const outputTemplate = path.join(downloadDir, `video.%(ext)s`);

  const platform = detectPlatform(url);
  const startTime = Date.now();
  const timeoutMs = platform === 'YouTube' ? TIMEOUT_YOUTUBE : TIMEOUT_DEFAULT;

  const attempts = buildAttemptArgs(url, outputTemplate, platform);
  let lastError = '';
  let bestNonCookieError = '';
  let attemptCount = 0;
  let lastAttemptLabel = '';

  console.log(`[Unreel] Starting download: ${platform} | ${attempts.length} strategies queued | timeout ${timeoutMs / 1000}s`);

  for (const attempt of attempts) {
    attemptCount++;

    // Add inter-attempt delay to avoid rate-limit escalation
    if (attemptCount > 1) {
      const isSameHost = lastAttemptLabel.split(':')[0] === attempt.label.split(':')[0];
      const delay = isSameHost ? RETRY_DELAY_SAME_HOST_MS : RETRY_DELAY_MS;
      await sleep(delay);
    }
    lastAttemptLabel = attempt.label;

    try {
      const result = await runYtDlp(attempt.args, downloadDir, platform, timeoutMs);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[Unreel] Download succeeded: ${attempt.label} (attempt ${attemptCount}/${attempts.length}, ${elapsed}s)`);
      return result;
    } catch (err) {
      lastError = err.message || 'Unknown yt-dlp error';
      if (!attempt.label.includes(BROWSER_COOKIE_LABEL_TOKEN) && !bestNonCookieError) {
        bestNonCookieError = lastError;
      }
      console.warn(`[Unreel] Strategy failed (${attemptCount}/${attempts.length}) [${attempt.label}]: ${lastError.split('\n')[0]}`);
    }
  }

  cleanupDownloadDir(downloadDir);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.error(`[Unreel] All ${attemptCount} download strategies failed for ${platform} in ${elapsed}s`);

  const rawError = bestNonCookieError || lastError;
  const errorCategory = categorizeError(rawError, platform);
  throw new Error(`yt-dlp failed. Platform: ${platform}. Category: ${errorCategory}.\n${rawError.slice(0, 700)}`);
}

/**
 * Categorize download errors for better user-facing messages.
 */
function categorizeError(errorText, platform) {
  const lower = (errorText || '').toLowerCase();

  if (lower.includes('login required') || lower.includes('private') || lower.includes('not available')) {
    return 'PRIVATE_OR_LOGIN';
  }
  if (lower.includes('sign in to confirm') || lower.includes('bot') || lower.includes('429') || lower.includes('too many requests') || lower.includes('rate limit')) {
    return 'RATE_LIMITED';
  }
  if (lower.includes('requested format is not available') || lower.includes('no video formats')) {
    return 'FORMAT_UNAVAILABLE';
  }
  if (lower.includes('unable to download') || lower.includes('urlopen error') || lower.includes('timed out') || lower.includes('connection') || lower.includes('network')) {
    return 'NETWORK_ERROR';
  }
  if (lower.includes('not a valid url') || lower.includes('unsupported url')) {
    return 'INVALID_URL';
  }
  return 'UNKNOWN';
}

function buildAttemptArgs(url, outputTemplate, platform) {
  const baseArgs = buildBaseArgs(url, outputTemplate);
  const sharedCookiesFile = getSharedYtDlpCookiesFile();

  // Start with the default (no cookies, no special args)
  const attempts = [];

  // ── YouTube strategies ──
  // Ordered by reliability: most reliable first
  if (platform === 'YouTube') {
    const ytCookieArgs = sharedCookiesFile && fs.existsSync(sharedCookiesFile)
      ? ['--cookies', sharedCookiesFile]
      : [];

    // Strategy 1: web + android clients (most reliable combo)
    attempts.push({
      label: 'youtube-web-android',
      args: [
        ...buildBaseArgs(url, outputTemplate),
        '--extractor-args', 'youtube:player_client=web,android',
        ...ytCookieArgs,
      ],
    });

    // Strategy 2: mweb + ios (bypasses some blocks)
    attempts.push({
      label: 'youtube-mweb-ios',
      args: [
        ...buildBaseArgs(url, outputTemplate),
        '--extractor-args', 'youtube:player_client=mweb,ios',
        ...ytCookieArgs,
      ],
    });

    // Strategy 3: tv + web (for age-restricted or geo-blocked)
    attempts.push({
      label: 'youtube-tv-web',
      args: [
        ...buildBaseArgs(url, outputTemplate),
        '--extractor-args', 'youtube:player_client=tv,web',
        ...ytCookieArgs,
      ],
    });

    // Strategy 4: default (no extractor args)
    if (sharedCookiesFile && fs.existsSync(sharedCookiesFile)) {
      attempts.push({
        label: 'youtube-default-shared-cookies',
        args: [...baseArgs, '--cookies', sharedCookiesFile],
      });
    }
    attempts.push({
      label: 'youtube-default',
      args: [...baseArgs],
    });

    // Strategy 5: skip webpage parsing (helps with bot detection)
    attempts.push({
      label: 'youtube-skip-webpage',
      args: [
        ...buildBaseArgs(url, outputTemplate),
        '--extractor-args', 'youtube:player_skip=webpage;player_client=web,android',
        ...ytCookieArgs,
      ],
    });

    // Strategy 6: last resort — disable cert check
    attempts.push({
      label: 'youtube-no-cert-check',
      args: [
        ...buildBaseArgs(url, outputTemplate),
        '--extractor-args', 'youtube:player_client=web,android',
        '--no-check-certificates',
        ...ytCookieArgs,
      ],
    });
  }

  // ── Instagram strategies ──
  else if (platform === 'Instagram') {
    const normalizedUrls = buildInstagramUrlVariants(url);
    const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
    const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

    // Use a format string that includes audio-only fallback for reels that have
    // split audio/video streams or audio-only posts.
    const igFormatArgs = ['--format', 'bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[ext=mp4]/best/bestaudio'];

    const extractorModes = [
      { key: 'web-client-api-v1', value: 'instagram:player_client=web;api_version=v1' },
      { key: 'web-client', value: 'instagram:player_client=web' },
      { key: 'api-v1', value: 'instagram:api_version=v1' },
    ];

    // Cookie-based attempts first (most reliable for Instagram)
    const cookiesFile = getInstagramCookiesFile() || sharedCookiesFile;
    if (cookiesFile && fs.existsSync(cookiesFile)) {
      const cookieUrl = normalizedUrls[0] || url;
      attempts.push({
        label: 'instagram-cookies-file',
        args: [
          ...buildBaseArgs(cookieUrl, outputTemplate, igFormatArgs),
          '--extractor-args', 'instagram:player_client=web;api_version=v1',
          '--referer', 'https://www.instagram.com/',
          '--user-agent', DESKTOP_UA,
          '--cookies', cookiesFile,
          '--sleep-requests', '1',
        ],
      });
    }

    // Primary URL variants × extractor modes
    for (const candidateUrl of normalizedUrls) {
      for (const mode of extractorModes) {
        attempts.push({
          label: `instagram-${mode.key}:${candidateUrl}`,
          args: [
            ...buildBaseArgs(candidateUrl, outputTemplate, igFormatArgs),
            '--extractor-args', mode.value,
            '--referer', 'https://www.instagram.com/',
            '--user-agent', DESKTOP_UA,
            '--sleep-requests', '1',
          ],
        });
      }
      // Mobile UA with best extractor mode
      attempts.push({
        label: `instagram-mobile-ua:${candidateUrl}`,
        args: [
          ...buildBaseArgs(candidateUrl, outputTemplate, igFormatArgs),
          '--extractor-args', 'instagram:player_client=web;api_version=v1',
          '--referer', 'https://www.instagram.com/',
          '--user-agent', MOBILE_UA,
          '--sleep-requests', '1',
        ],
      });
    }

    // Browser cookie attempts (local dev only)
    if (canUseBrowserCookies()) {
      const cookieUrl = normalizedUrls[0] || url;
      for (const browser of INSTAGRAM_BROWSER_CANDIDATES) {
        attempts.push({
          label: `instagram-cookies-from-${browser}`,
          args: [
            ...buildBaseArgs(cookieUrl, outputTemplate, igFormatArgs),
            '--extractor-args', 'instagram:player_client=web;api_version=v1',
            '--referer', 'https://www.instagram.com/',
            '--user-agent', DESKTOP_UA,
            '--cookies-from-browser', browser,
            '--sleep-requests', '1',
          ],
        });
      }
    }

    // Last resort: force generic extractor
    const genericUrl = normalizedUrls[0] || url;
    attempts.push({
      label: 'instagram-force-generic',
      args: [
        ...buildBaseArgs(genericUrl, outputTemplate, igFormatArgs),
        '--force-generic-extractor',
        '--referer', 'https://www.instagram.com/',
        '--user-agent', DESKTOP_UA,
      ],
    });
  }

  // ── Other platforms (TikTok, Twitter/X, etc.) ──
  else {
    if (sharedCookiesFile && fs.existsSync(sharedCookiesFile)) {
      attempts.push({
        label: 'default-shared-cookies',
        args: [...baseArgs, '--cookies', sharedCookiesFile],
      });
    }
    attempts.push({
      label: 'default',
      args: [...baseArgs],
    });
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

function buildBaseArgs(targetUrl, outputTemplate, formatOverride) {
  const formatArgs = formatOverride || [
    '--format', 'bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best',
  ];
  return [
    targetUrl,
    '-o', outputTemplate,
    ...formatArgs,
    '--merge-output-format', 'mp4',
    '--max-filesize', '50M',
    '--no-playlist',
    '--no-simulate',
    '--write-subs',
    '--write-auto-subs',
    '--sub-langs', 'all',
    '--convert-subs', 'srt',
    '--write-info-json',
    '--print', 'UNREEL_TITLE:%(title)s',
    '--print', 'UNREEL_UPLOAD_DATE:%(upload_date>%Y-%m-%d)s',
    '--no-warnings',
    '--retries', '5',
    '--fragment-retries', '5',
    '--extractor-retries', '5',
    '--file-access-retries', '5',
    '--socket-timeout', '30',
    '--retry-sleep', 'linear=1::5',
  ];
}

function buildInstagramUrlVariants(rawUrl) {
  const variants = [];
  const pushUnique = (value) => {
    if (value && !variants.includes(value)) variants.push(value);
  };

  // Handle ddinstagram.com / dd redirect URLs
  let processedUrl = rawUrl;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.hostname.includes('ddinstagram.com')) {
      parsed.hostname = 'www.instagram.com';
      processedUrl = parsed.toString();
    }
  } catch {}

  pushUnique(processedUrl);

  try {
    const parsed = new URL(processedUrl);
    parsed.hash = '';
    // Remove tracking params but keep essential ones
    const keepParams = new Set(['img_index']);
    for (const key of [...parsed.searchParams.keys()]) {
      if (!keepParams.has(key)) {
        parsed.searchParams.delete(key);
      }
    }

    if (parsed.hostname === 'm.instagram.com') {
      parsed.hostname = 'www.instagram.com';
    }

    // Convert share-style paths to canonical reel paths
    parsed.pathname = parsed.pathname.replace(/^\/share\/reel\//, '/reel/');
    parsed.pathname = parsed.pathname.replace(/^\/share\/p\//, '/p/');

    if (!parsed.pathname.endsWith('/')) {
      parsed.pathname = `${parsed.pathname}/`;
    }

    pushUnique(parsed.toString());

    // Also try without www
    const noWww = new URL(parsed.toString());
    noWww.hostname = 'instagram.com';
    pushUnique(noWww.toString());

    // If it's a /p/ URL (post that might be video), also try /reel/ variant
    const reelMatch = parsed.pathname.match(/^\/p\/([A-Za-z0-9_-]+)\//);
    if (reelMatch) {
      const reelUrl = new URL(parsed.toString());
      reelUrl.pathname = `/reel/${reelMatch[1]}/`;
      pushUnique(reelUrl.toString());
    }
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
    resolvedInstagramCookiesFile = writeCookiesFromBase64(base64Cookies, 'unreel_instagram_cookies.txt');
    return resolvedInstagramCookiesFile;
  } catch (error) {
    console.warn(`[Unreel] Failed to decode INSTAGRAM_COOKIES_B64: ${error.message}`);
    return null;
  }
}

function getSharedYtDlpCookiesFile() {
  if (resolvedYtDlpCookiesFile) return resolvedYtDlpCookiesFile;

  const explicitFile = process.env.YTDLP_COOKIES_FILE;
  if (explicitFile && fs.existsSync(explicitFile)) {
    resolvedYtDlpCookiesFile = explicitFile;
    return resolvedYtDlpCookiesFile;
  }

  const base64Cookies = process.env.YTDLP_COOKIES_B64;
  if (!base64Cookies) return null;

  try {
    resolvedYtDlpCookiesFile = writeCookiesFromBase64(base64Cookies, 'unreel_ytdlp_cookies.txt');
    return resolvedYtDlpCookiesFile;
  } catch (error) {
    console.warn(`[Unreel] Failed to decode YTDLP_COOKIES_B64: ${error.message}`);
    return null;
  }
}

function writeCookiesFromBase64(base64Text, fileName) {
  const cookieText = Buffer.from(base64Text, 'base64').toString('utf8').trim();
  if (!cookieText) return null;

  const cookiePath = path.join(TEMP_DIR, fileName);
  fs.writeFileSync(cookiePath, cookieText, 'utf8');
  return cookiePath;
}

function runYtDlp(args, downloadDir, platform, timeoutMs) {
  return new Promise((resolve, reject) => {
    let ytdlp;
    try {
      ytdlp = spawn(YT_DLP_PATH, args);
    } catch (err) {
      reject(new Error(`Failed to spawn yt-dlp (${YT_DLP_PATH}): ${err.message}`));
      return;
    }

    let stdout = '';
    let stderr = '';

    ytdlp.stdout.on('data', data => { stdout += data.toString(); });
    ytdlp.stderr.on('data', data => { stderr += data.toString(); });

    const timer = setTimeout(() => {
      ytdlp.kill('SIGKILL');
      reject(new Error(`Download timed out after ${timeoutMs / 1000} seconds.`));
    }, timeoutMs);

    ytdlp.on('close', code => {
      clearTimeout(timer);

      let matchedFiles = [];
      try {
        matchedFiles = fs.readdirSync(downloadDir);
      } catch {}

      const downloaded = findDownloadedMediaFile(matchedFiles);

      if (code === 0 && downloaded) {
        const title = parsePrintedField(stdout, 'UNREEL_TITLE:') || 'Unknown Video';
        const publishedAt = normalizePublishedDate(parsePrintedField(stdout, 'UNREEL_UPLOAD_DATE:'));
        const videoPath = path.join(downloadDir, downloaded);
        const subtitleCaptions = extractCaptionText(matchedFiles, downloaded, downloadDir);
        
        // Extract description from JSON metadata file for full content without truncation
        let description = '';
        const jsonFile = matchedFiles.find(f => f.endsWith('.info.json'));
        if (jsonFile) {
          try {
            const jsonPath = path.join(downloadDir, jsonFile);
            const metadata = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            description = normalizeText(metadata.description || '');
            fs.unlinkSync(jsonPath);
          } catch (err) {
            console.warn(`[Unreel] Failed to read JSON metadata: ${err.message}`);
          }
        }
        
        const captions = subtitleCaptions || description;
        const fileSizeMB = (fs.statSync(videoPath).size / (1024 * 1024)).toFixed(1);
        console.log(`[Unreel] Downloaded file: ${videoPath} (${fileSizeMB} MB)`);
        resolve({
          videoPath,
          title,
          platform,
          publishedAt,
          captions: captions || null,
          captionSource: subtitleCaptions ? 'subtitles' : description ? 'description' : null,
        });
        return;
      }

      reject(new Error(`yt-dlp exited with code ${code}. ${(stderr || stdout).trim().slice(0, 700)}`));
    });

    ytdlp.on('error', err => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn yt-dlp (${YT_DLP_PATH}): ${err.message}`));
    });
  });
}

/**
 * Clean up the per-download directory and all its contents.
 */
function cleanupDownloadDir(downloadDir) {
  try {
    const files = fs.readdirSync(downloadDir);
    for (const f of files) {
      try { fs.unlinkSync(path.join(downloadDir, f)); } catch {}
    }
    fs.rmdirSync(downloadDir);
  } catch {}
}

function findDownloadedMediaFile(files) {
  const candidates = files
    .filter(fileName => {
      const ext = path.extname(fileName).toLowerCase();
      return ext && MEDIA_EXTENSIONS.has(ext) && !SUBTITLE_EXTENSIONS.has(ext);
    })
    .sort((a, b) => {
      const aScore = mediaPriorityScore(a);
      const bScore = mediaPriorityScore(b);
      return aScore - bScore;
    });

  return candidates[0] || null;
}

function mediaPriorityScore(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === '.mp4') return 0;
  if (ext === '.mkv' || ext === '.webm' || ext === '.mov' || ext === '.m4v') return 1;
  return 2;
}

function extractCaptionText(files, mediaFileName, downloadDir) {
  const captionFiles = files.filter((fileName) => {
    if (fileName === mediaFileName) return false;
    const ext = path.extname(fileName).toLowerCase();
    return SUBTITLE_EXTENSIONS.has(ext);
  });

  if (captionFiles.length === 0) return '';

  const textSegments = [];
  for (const fileName of captionFiles) {
    const filePath = path.join(downloadDir, fileName);
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const normalized = normalizeCaptionFileText(raw);
      if (normalized) textSegments.push(normalized);
      fs.unlinkSync(filePath);
    } catch {}
  }

  return textSegments.join('\n\n').trim();
}

function normalizeCaptionFileText(rawText) {
  const lines = String(rawText || '')
    .replace(/\r/g, '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !/^WEBVTT/i.test(line))
    .filter(line => !/^\d+$/.test(line))
    .filter(line => !/^(NOTE|STYLE|REGION)\b/i.test(line))
    .filter(line => !/^\d{2}:\d{2}:\d{2}[.,]\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}[.,]\d{3}/.test(line))
    .filter(line => !/^<[^>]+>$/.test(line))
    .map(line => line.replace(/<[^>]+>/g, '').trim())
    .filter(Boolean);

  return lines.join(' ').replace(/\s+/g, ' ').trim();
}

function normalizeText(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .replace(/\u0000/g, '')
    .trim();
}

function detectPlatform(url) {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube';
  if (url.includes('instagram.com') || url.includes('ddinstagram.com')) return 'Instagram';
  if (url.includes('tiktok.com')) return 'TikTok';
  if (url.includes('t.me') || url.includes('telegram.me')) return 'Telegram';
  if (url.includes('twitter.com') || url.includes('x.com')) return 'Twitter/X';
  if (url.includes('facebook.com')) return 'Facebook';
  return 'Unknown';
}

function getYtDlpVersion() {
  if (!YT_DLP_PATH) return null;
  try {
    return execSync(`"${YT_DLP_PATH}" --version`, { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function parsePrintedField(stdout, prefix) {
  const lines = String(stdout || '').split(/\r?\n/);
  for (const line of lines) {
    if (line.startsWith(prefix)) {
      return line.slice(prefix.length).trim();
    }
  }
  return '';
}

function normalizePublishedDate(value) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
  return null;
}

function getDownloaderDiagnostics() {
  return {
    ytDlpPath: YT_DLP_PATH,
    ytDlpVersion: YT_DLP_VERSION,
    ytDlpCookiesConfigured: !!getSharedYtDlpCookiesFile(),
    instagramCookiesConfigured: !!getInstagramCookiesFile(),
    browserCookiesEnabled: canUseBrowserCookies(),
    platform: process.platform,
    render: !!process.env.RENDER,
    railway: !!process.env.RAILWAY_ENVIRONMENT,
  };
}

module.exports = { downloadVideo, detectPlatform, getDownloaderDiagnostics };
