const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');

const GENERIC_URL_RE = /https?:\/\/[^\s]+/gi;
const TYPING_HEARTBEAT_MS = 4000;
const MAX_FACT_CHECKS_IN_MESSAGE = 5;
const ACTIONS = {
  HELP: 'Help',
  SUPPORTED: 'Supported Links',
  EXAMPLES: 'Sample Links',
  STATUS: 'Status',
};
let botInstance = null;

function startTelegramBot(options = {}) {
  if (botInstance) return botInstance;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log('[Unreel][Telegram] TELEGRAM_BOT_TOKEN not set. Bot is disabled.');
    return null;
  }

  const apiBaseUrl = options.apiBaseUrl || process.env.TELEGRAM_ANALYZE_API_URL;
  if (!apiBaseUrl) {
    console.warn('[Unreel][Telegram] TELEGRAM_ANALYZE_API_URL not set. Bot is disabled.');
    return null;
  }

  const polling = process.env.TELEGRAM_BOT_POLLING !== 'false';
  const bot = new TelegramBot(token, { polling });
  const inFlightChats = new Set();

  bot.onText(/^\/start(?:\s+.*)?$/i, (msg) => {
    const chatId = msg.chat.id;
    sendMenuMessage(bot, chatId, getWelcomeMessage());
  });

  bot.onText(/^\/help(?:\s+.*)?$/i, (msg) => {
    sendMenuMessage(bot, msg.chat.id, getHelpMessage());
  });

  bot.onText(/^\/supported(?:\s+.*)?$/i, (msg) => {
    sendMenuMessage(bot, msg.chat.id, getSupportedLinksMessage());
  });

  bot.onText(/^\/examples(?:\s+.*)?$/i, (msg) => {
    sendMenuMessage(bot, msg.chat.id, getSampleLinksMessage());
  });

  bot.onText(/^\/status(?:\s+.*)?$/i, (msg) => {
    const chatId = msg.chat.id;
    if (inFlightChats.has(chatId)) {
      sendMenuMessage(bot, chatId, 'One analysis is currently running for this chat. I will send the report once it completes.');
      return;
    }
    sendMenuMessage(bot, chatId, 'No analysis is running right now. Send a link any time.');
  });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = (msg.text || msg.caption || '').trim();
    const normalizedText = text.toLowerCase();

    if (normalizedText === ACTIONS.HELP.toLowerCase()) {
      await sendMenuMessage(bot, chatId, getHelpMessage());
      return;
    }

    if (normalizedText === ACTIONS.SUPPORTED.toLowerCase()) {
      await sendMenuMessage(bot, chatId, getSupportedLinksMessage());
      return;
    }

    if (normalizedText === ACTIONS.EXAMPLES.toLowerCase()) {
      await sendMenuMessage(bot, chatId, getSampleLinksMessage());
      return;
    }

    if (normalizedText === ACTIONS.STATUS.toLowerCase()) {
      if (inFlightChats.has(chatId)) {
        await sendMenuMessage(bot, chatId, 'One analysis is currently running for this chat. I will send the report once it completes.');
      } else {
        await sendMenuMessage(bot, chatId, 'No analysis is running right now. Send a link any time.');
      }
      return;
    }

    if (!text && (msg.video || msg.document)) {
      await sendMenuMessage(bot, chatId, 'I currently analyze links only. Please send a public link instead of uploading a file.');
      return;
    }

    if (!text) {
      await sendMenuMessage(bot, chatId, getHelpMessage());
      return;
    }

    if (text.startsWith('/')) return;

    const parsedInput = parseVideoLinkFromText(text);

    if (parsedInput.urlsFound > 1) {
      await sendMenuMessage(bot, chatId, 'Please send one link at a time so I can analyze it correctly.');
      return;
    }

    if (!parsedInput.link) {
      if (parsedInput.urlsFound > 0) {
        await sendMenuMessage(bot, chatId, [
          'I found a URL, but it is not a supported video link.',
          '',
          getSupportedLinksMessage(),
        ].join('\n'));
        return;
      }
      await sendMenuMessage(bot, chatId, [
        'Please send a valid public video link.',
        '',
        getSupportedLinksMessage(),
      ].join('\n'));
      return;
    }

    const link = parsedInput.link;
    const sourceLabel = detectInputPlatform(link);

    if (inFlightChats.has(chatId)) {
      await sendMenuMessage(bot, chatId, 'An analysis is already running for this chat. Please wait for it to finish before sending another link.');
      return;
    }

    inFlightChats.add(chatId);
    let typingTimer = null;
    try {
      await sendMenuMessage(bot, chatId, [
        `Received ${sourceLabel} link.`,
        'Analysis started. This usually takes around 1-3 minutes depending on video length and download speed.',
      ].join('\n'));

      typingTimer = startTypingHeartbeat(bot, chatId);

      const response = await axios.post(
        `${stripTrailingSlash(apiBaseUrl)}/api/analyze/url`,
        { url: link },
        { timeout: 10 * 60 * 1000 }
      );

      const result = response.data || {};
      const message = buildResultMessage(result, link);
      await sendMenuMessage(bot, chatId, message, { disable_web_page_preview: true });
    } catch (error) {
      await sendMenuMessage(bot, chatId, buildFailureMessage(error, link));
    } finally {
      stopTypingHeartbeat(typingTimer);
      inFlightChats.delete(chatId);
    }
  });

  bot.on('polling_error', (err) => {
    console.error('[Unreel][Telegram] Polling error:', err.message);
  });

  botInstance = bot;
  console.log('[Unreel][Telegram] Bot started successfully.');
  return botInstance;
}

function parseVideoLinkFromText(text) {
  const urls = String(text || '').match(GENERIC_URL_RE) || [];
  for (const raw of urls) {
    const cleaned = raw.replace(/[),.;!?]+$/, '');
    if (isSupportedVideoUrl(cleaned)) {
      return { link: cleaned, urlsFound: urls.length };
    }
  }
  return { link: null, urlsFound: urls.length };
}

function isSupportedVideoUrl(value) {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    if (host === 't.me' || host === 'telegram.me' || host.endsWith('.t.me')) {
      return path.split('/').filter(Boolean).length >= 2;
    }

    if (host.includes('instagram.com')) {
      return path.includes('/reel/') || path.includes('/reels/');
    }

    if (host.includes('youtube.com')) {
      return path.includes('/shorts/');
    }

    if (host === 'youtu.be') {
      return path.split('/').filter(Boolean).length >= 1;
    }

    return false;
  } catch {
    return false;
  }
}

function buildResultMessage(result, fallbackUrl) {
  const info = result.videoInfo || {};
  const checks = Array.isArray(result.factChecks) ? result.factChecks : [];
  const bias = result.bias || {};
  const summary = summarizeVerdicts(checks);

  const lines = [];
  lines.push('UNREEL ANALYSIS REPORT');
  lines.push('Status: Completed');
  lines.push('');
  lines.push('Video Overview');
  lines.push(`- Title: ${truncate(info.title || 'Unknown Video', 160)}`);
  lines.push(`- Platform: ${info.platform || 'Unknown'}`);
  lines.push(`- Source: ${info.url || fallbackUrl}`);
  if (result.analyzedAt) lines.push(`- Analyzed At: ${formatIsoDate(result.analyzedAt)}`);
  lines.push('');

  if (checks.length === 0) {
    lines.push('Fact-Check Summary');
    lines.push('- No clear factual claims detected in this content.');
  } else {
    lines.push('Fact-Check Summary');
    lines.push(`- Claims Reviewed: ${checks.length}`);
      lines.push(`- Verdict Breakdown: TRUE ${summary.TRUE}, FALSE ${summary.FALSE}, MISLEADING ${summary.MISLEADING}, MIXED ${summary.MIXED}, UNVERIFIED ${summary.UNVERIFIED}`);
    lines.push('');
    lines.push(`Top Findings (${Math.min(checks.length, MAX_FACT_CHECKS_IN_MESSAGE)})`);
    checks.slice(0, MAX_FACT_CHECKS_IN_MESSAGE).forEach((item, idx) => {
      const verdict = normalizeVerdict(item.verdict);
      const claim = String(item.claim || '').trim() || 'No claim text';
      const confidence = normalizeConfidence(item.confidence);
      const explanation = String(item.explanation || '').trim();
      lines.push(`${idx + 1}. Verdict: ${verdict}`);
      lines.push(`   Claim: ${truncate(claim, 220)}`);
      if (confidence) lines.push(`   Confidence: ${confidence}`);
      if (item.recency) lines.push(`   Recency: ${String(item.recency).toUpperCase()}`);
      if (explanation) lines.push(`   Notes: ${truncate(explanation, 240)}`);
    });
    if (checks.length > MAX_FACT_CHECKS_IN_MESSAGE) {
      lines.push(`...and ${checks.length - MAX_FACT_CHECKS_IN_MESSAGE} more claim checks.`);
    }
  }

  lines.push('');
  lines.push('Bias Assessment');
  lines.push(`- Bias Score: ${bias.score ?? 'N/A'} / 100`);
  if (bias.type) lines.push(`- Bias Type: ${bias.type}`);
  if (bias.summary) lines.push(`- Summary: ${truncate(String(bias.summary), 320)}`);

  lines.push('');
  lines.push('Next Step: Send another public link to analyze a new video.');

  return truncate(lines.join('\n'), 3900);
}

function summarizeVerdicts(checks) {
  const stats = {
    TRUE: 0,
    FALSE: 0,
    MISLEADING: 0,
      MIXED: 0,
    UNVERIFIED: 0,
  };

  checks.forEach((item) => {
    const verdict = normalizeVerdict(item?.verdict);
    if (stats[verdict] !== undefined) {
      stats[verdict] += 1;
      return;
    }
    stats.UNVERIFIED += 1;
  });

  return stats;
}

function normalizeVerdict(value) {
  const v = String(value || '').toLowerCase();
  if (v.includes('true')) return 'TRUE';
  if (v.includes('false')) return 'FALSE';
  if (v.includes('mislead')) return 'MISLEADING';
  if (v.includes('mixed')) return 'MIXED';
  if (v.includes('unverified')) return 'UNVERIFIED';
  return (String(value || 'UNVERIFIED').toUpperCase());
}

function normalizeConfidence(value) {
  const v = String(value || '').trim();
  if (!v) return null;
  return v.toUpperCase();
}

function truncate(text, max) {
  if (!text || text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
}

function stripTrailingSlash(url) {
  return String(url || '').replace(/\/+$/, '');
}

function detectInputPlatform(value) {
  const raw = String(value || '').toLowerCase();
  if (raw.includes('instagram.com')) return 'Instagram Reel';
  if (raw.includes('youtube.com/shorts') || raw.includes('youtu.be/')) return 'YouTube Short';
  if (raw.includes('t.me') || raw.includes('telegram.me')) return 'Telegram';
  return 'video';
}

function getWelcomeMessage() {
  return [
    'Welcome to Unreel.',
    '',
    'I analyze short-form videos and return a professional fact-check + bias report.',
    '',
    getSupportedLinksMessage(),
    '',
    'How to use:',
    '1. Send one public link.',
    '2. Wait for processing (usually 1-3 minutes).',
    '3. Receive a structured analysis report.',
    '',
    'Commands:',
    '/help - show instructions',
    '/supported - show accepted link types',
    '/status - check if analysis is in progress',
  ].join('\n');
}

function getHelpMessage() {
  return [
    'Instructions',
    '',
    getSupportedLinksMessage(),
    '',
    'Tips:',
    '- Send one link per message.',
    '- Ensure the post/video is public.',
    '- If download fails, retry in a few minutes (platforms may rate-limit requests).',
    '',
    'Shortcuts:',
    '/help, /supported, /examples, /status',
  ].join('\n');
}

function getSupportedLinksMessage() {
  return [
    'Supported links:',
    '- Telegram post: https://t.me/channel/123',
    '- Instagram Reel: https://www.instagram.com/reel/... or /reels/...',
    '- YouTube Short: https://www.youtube.com/shorts/...',
  ].join('\n');
}

function getSampleLinksMessage() {
  return [
    'Sample links you can send:',
    '- https://t.me/durov/200',
    '- https://www.instagram.com/reel/C5QxHh7oABC/',
    '- https://www.instagram.com/reels/C5QxHh7oABC/',
    '- https://www.youtube.com/shorts/aqz-KE-bpKQ',
  ].join('\n');
}

function buildFailureMessage(error, sourceUrl) {
  const raw = String(error?.response?.data?.error || error?.message || 'Unknown error').trim();
  const lower = raw.toLowerCase();

  if (lower.includes('please provide a valid video url')) {
    return [
      'Analysis failed: the provided URL format is invalid.',
      '',
      getSupportedLinksMessage(),
    ].join('\n');
  }

  if (lower.includes('private') || lower.includes('login-protected')) {
    return [
      'Analysis failed: this link appears private or login-protected.',
      'Please send a public post/video link.',
    ].join('\n');
  }

  if (lower.includes('rate-limit') || lower.includes('429') || lower.includes('too many requests')) {
    return [
      'Analysis could not complete due to platform rate limiting.',
      'Please retry after a few minutes.',
    ].join('\n');
  }

  if (lower.includes('timed out') || lower.includes('timeout')) {
    return [
      'Analysis timed out while downloading or processing the video.',
      'Please retry with the same link in a moment.',
    ].join('\n');
  }

  if (lower.includes('yt-dlp not found')) {
    return 'Analysis failed: server downloader is not configured (yt-dlp missing).';
  }

  if (lower.includes('could not download this video')) {
    return [
      'Analysis failed: the platform did not allow video download for this link right now.',
      'If the post is public, retry shortly. Some platforms temporarily block automated downloads.',
      '',
      `Source: ${sourceUrl}`,
    ].join('\n');
  }

  return [
    'Analysis failed due to an unexpected server error.',
    `Details: ${truncate(raw, 280)}`,
  ].join('\n');
}

function startTypingHeartbeat(bot, chatId) {
  safeSendTyping(bot, chatId);
  return setInterval(() => safeSendTyping(bot, chatId), TYPING_HEARTBEAT_MS);
}

function stopTypingHeartbeat(timer) {
  if (timer) clearInterval(timer);
}

function safeSendTyping(bot, chatId) {
  bot.sendChatAction(chatId, 'typing').catch(() => {});
}

function formatIsoDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString().replace('T', ' ').replace('.000Z', ' UTC');
}

function getMainMenuKeyboard() {
  return {
    keyboard: [
      [ACTIONS.HELP, ACTIONS.SUPPORTED],
      [ACTIONS.EXAMPLES, ACTIONS.STATUS],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
    input_field_placeholder: 'Paste a public video link to analyze',
  };
}

function sendMenuMessage(bot, chatId, text, options = {}) {
  const mergedOptions = {
    ...options,
    disable_web_page_preview: options.disable_web_page_preview ?? true,
    reply_markup: getMainMenuKeyboard(),
  };
  return bot.sendMessage(chatId, text, mergedOptions);
}

module.exports = { startTelegramBot };
