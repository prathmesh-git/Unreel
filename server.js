require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

const analyzeRoutes = require('./routes/analyze');
const resultsRoutes = require('./routes/results');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const SITE_URL = (process.env.SITE_URL || '').replace(/\/$/, '');

function getBaseUrl(req) {
  if (SITE_URL) return SITE_URL;
  return `${req.protocol}://${req.get('host')}`;
}

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

// ─── Serve React Frontend ─────────────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║         🎬 UNREEL SERVER 🎬           ║
║   Reveal the truth behind every reel  ║
╠═══════════════════════════════════════╣
║  Running at: http://localhost:${PORT}     ║
╚═══════════════════════════════════════╝
  `);
});
