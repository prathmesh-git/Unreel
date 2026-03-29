require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { getDownloaderDiagnostics } = require('./modules/downloader');
const { getMailDiagnostics, verifyMailTransport } = require('./modules/mailer');
const { startTelegramBot } = require('./modules/telegramBot');

const analyzeRoutes = require('./routes/analyze');
const resultsRoutes = require('./routes/results');
const authRoutes = require('./routes/auth');
const historyRoutes = require('./routes/history');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const SITE_URL = (process.env.SITE_URL || '').replace(/\/$/, '');
const publicDir = path.join(__dirname, 'public');
const hasBuiltFrontend = fs.existsSync(path.join(publicDir, 'index.html'));

function getBaseUrl(req) {
  if (SITE_URL) return SITE_URL;
  return `${req.protocol}://${req.get('host')}`;
}

const isProd = process.env.NODE_ENV === 'production';
const shouldServeFrontend = isProd || hasBuiltFrontend;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Serve static frontend assets whenever a frontend build is available.
if (shouldServeFrontend) {
  app.use(express.static(publicDir));
}

// ─── Database ─────────────────────────────────────────────────────────────────
if (MONGODB_URI) {
  mongoose
    .connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
    .then(() => console.log('[Unreel] MongoDB connected successfully.'))
    .catch((err) => console.error('[Unreel] MongoDB connection failed:', err.message));
} else {
  console.warn('[Unreel] MONGODB_URI not set. Running without persistence.');
}

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/analyze', analyzeRoutes);
app.use('/api/results', resultsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/history', historyRoutes);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    mongo: {
      connected: mongoose.connection.readyState === 1,
      readyState: mongoose.connection.readyState,
    },
    keys: {
      groq: !!process.env.GROQ_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
      tavily: !!process.env.TAVILY_API_KEY,
    },
    mail: getMailDiagnostics(),
  });
});

app.get('/api/health/downloader', (_req, res) => {
  res.json({
    status: 'ok',
    downloader: getDownloaderDiagnostics(),
  });
});

app.get('/api/health/mail', async (_req, res) => {
  const diagnostics = getMailDiagnostics();
  const verify = await verifyMailTransport();

  res.status(verify.ok ? 200 : 500).json({
    status: verify.ok ? 'ok' : 'error',
    mail: diagnostics,
    verify,
  });
});

app.get('/sitemap.xml', (req, res) => {
  const baseUrl = getBaseUrl(req);
  const today = new Date().toISOString();
  const urls = [
    { loc: `${baseUrl}/`, changefreq: 'daily', priority: '1.0', lastmod: today },
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => (
      `  <url>\n` +
      `    <loc>${u.loc}</loc>\n` +
      `    <lastmod>${u.lastmod}</lastmod>\n` +
      `    <changefreq>${u.changefreq}</changefreq>\n` +
      `    <priority>${u.priority}</priority>\n` +
      `  </url>`
    )).join('\n') +
    `\n</urlset>`;

  res.type('application/xml').send(xml);
});

app.get('/robots.txt', (req, res) => {
  const baseUrl = getBaseUrl(req);
  const robots = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    '',
    `Sitemap: ${baseUrl}/sitemap.xml`,
  ].join('\n');

  res.type('text/plain').send(robots);
});

// ─── Serve React Frontend (when build exists) ─────────────────────────────────
if (shouldServeFrontend) {
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║         🎬 UNREEL SERVER 🎬           ║
║   Reveal the truth behind every reel  ║
╠═══════════════════════════════════════╣
║  Running at: http://localhost:${PORT}     ║
╚═══════════════════════════════════════╝
  `);

  const localApiUrl = process.env.TELEGRAM_ANALYZE_API_URL || `http://127.0.0.1:${PORT}`;
  startTelegramBot({ apiBaseUrl: localApiUrl });
});
