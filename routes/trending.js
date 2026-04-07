const express = require('express');
const mongoose = require('mongoose');
const Trending = require('../models/Trending');
const AnalysisResult = require('../models/AnalysisResult');

const router = express.Router();

// ─── GET /api/trending ────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database is not connected.' });
  }

  const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 30);

  try {
    // Fetch curated trending items
    const curated = await Trending.find({ active: true })
      .sort({ trendScore: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    // Also auto-generate from recent high-bias analyses
    const autoTrending = await AnalysisResult.find({
      'bias.score': { $gte: 50 },
    })
      .sort({ createdAt: -1 })
      .limit(Math.max(limit - curated.length, 5))
      .select({
        'videoInfo.title': 1,
        'videoInfo.platform': 1,
        'bias.score': 1,
        'bias.level': 1,
        views: 1,
        createdAt: 1,
      })
      .lean();

    const curatedItems = curated.map((t) => ({
      id: t._id,
      title: t.title,
      description: t.description,
      source: t.source,
      truthScore: t.truthScore,
      biasLevel: t.biasLevel,
      trendScore: t.trendScore,
      category: t.category,
      analysisId: t.analysisId,
      type: 'curated',
      createdAt: t.createdAt,
    }));

    const autoItems = autoTrending
      .filter((a) => !curated.some((c) => c.analysisId?.toString() === a._id.toString()))
      .map((a) => ({
        id: a._id,
        title: a.videoInfo?.title || 'Untitled Analysis',
        description: `${a.videoInfo?.platform || 'Video'} analysis with ${a.bias?.level || 'Unknown'} bias detected`,
        source: a.videoInfo?.platform || 'Platform',
        truthScore: a.bias?.score != null ? 100 - a.bias.score : null,
        biasLevel: a.bias?.level || 'Medium',
        trendScore: (a.views || 0) + (a.bias?.score || 0),
        category: 'Analysis',
        analysisId: a._id,
        type: 'auto',
        createdAt: a.createdAt,
      }));

    // Merge and sort by trendScore
    const all = [...curatedItems, ...autoItems]
      .sort((a, b) => b.trendScore - a.trendScore)
      .slice(0, limit);

    res.json({ success: true, count: all.length, items: all });
  } catch (err) {
    console.error('[Unreel] Trending fetch error:', err.message);
    res.status(500).json({ error: 'Could not fetch trending items.' });
  }
});

module.exports = router;
