const express = require('express');
const axios = require('axios');

const router = express.Router();

// ─── In-memory cache (24-hour TTL) ───────────────────────────────────────────
let cachedNews = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Negative cache — avoid hammering API on repeated failures
let lastFailTimestamp = 0;
const FAIL_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

/**
 * GET /api/news
 * Fetches trending news related to misinformation / fact-checking via GNews API.
 * Results are cached in-memory for 24 hours to minimise API usage.
 */
router.get('/', async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit || 6), 1), 10);

  // Return cached data if still fresh
  if (cachedNews && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return res.json({
      success: true,
      count: Math.min(cachedNews.length, limit),
      items: cachedNews.slice(0, limit),
      cached: true,
    });
  }

  const apiKey = process.env.GNEWS_API_KEY;

  if (!apiKey) {
    console.warn('[Unreel] GNEWS_API_KEY not set — trending news unavailable.');
    return res.json({ success: true, count: 0, items: [], error: 'News API key not configured.' });
  }

  // Don't retry if we recently failed
  if (Date.now() - lastFailTimestamp < FAIL_COOLDOWN_MS) {
    if (cachedNews) {
      return res.json({ success: true, count: Math.min(cachedNews.length, limit), items: cachedNews.slice(0, limit), cached: true, stale: true });
    }
    return res.json({ success: true, count: 0, items: [] });
  }

  try {
    const response = await axios.get('https://gnews.io/api/v4/search', {
      params: {
        q: 'misinformation OR "fake news" OR "fact check"',
        lang: 'en',
        max: 10,
        sortby: 'publishedAt',
        apikey: apiKey,
      },
      timeout: 10000,
    });

    const articles = response.data?.articles || [];

    const items = articles.map((article, index) => ({
      id: index,
      title: article.title || 'Untitled',
      description: article.description || '',
      url: article.url || '#',
      image: article.image || null,
      source: article.source?.name || 'Unknown',
      sourceUrl: article.source?.url || null,
      publishedAt: article.publishedAt || null,
    }));

    // Update cache
    cachedNews = items;
    cacheTimestamp = Date.now();
    lastFailTimestamp = 0;

    res.json({
      success: true,
      count: Math.min(items.length, limit),
      items: items.slice(0, limit),
      cached: false,
    });
  } catch (err) {
    const statusCode = err.response?.status;
    const responseData = err.response?.data;
    console.error(`[Unreel] GNews fetch error: ${err.message}${statusCode ? ` (HTTP ${statusCode})` : ''}`);
    if (responseData) console.error('[Unreel] GNews response:', JSON.stringify(responseData));

    lastFailTimestamp = Date.now();

    // If we have stale cache, serve it as fallback
    if (cachedNews) {
      return res.json({
        success: true,
        count: Math.min(cachedNews.length, limit),
        items: cachedNews.slice(0, limit),
        cached: true,
        stale: true,
      });
    }

    res.json({ success: true, count: 0, items: [] });
  }
});

module.exports = router;

