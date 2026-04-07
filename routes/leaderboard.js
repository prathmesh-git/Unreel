const express = require('express');
const mongoose = require('mongoose');
const AnalysisResult = require('../models/AnalysisResult');

const router = express.Router();

// ─── GET /api/top-analysed ────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database is not connected.' });
  }

  const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 30);
  const sortBy = req.query.sort || 'views'; // views | bias | recent

  let sortObj;
  switch (sortBy) {
    case 'bias':
      sortObj = { 'bias.score': -1, createdAt: -1 };
      break;
    case 'recent':
      sortObj = { createdAt: -1 };
      break;
    case 'views':
    default:
      sortObj = { views: -1, createdAt: -1 };
      break;
  }

  try {
    const docs = await AnalysisResult.find()
      .sort(sortObj)
      .limit(limit)
      .select({
        'videoInfo.title': 1,
        'videoInfo.platform': 1,
        'videoInfo.url': 1,
        'bias.score': 1,
        'bias.level': 1,
        factChecks: 1,
        views: 1,
        sourceType: 1,
        analyzedAt: 1,
        createdAt: 1,
      })
      .lean();

    const items = docs.map((doc, index) => ({
      rank: index + 1,
      id: doc._id,
      title: doc.videoInfo?.title || 'Video',
      platform: doc.videoInfo?.platform || 'Unknown',
      url: doc.videoInfo?.url || null,
      biasScore: doc.bias?.score ?? 0,
      biasLevel: doc.bias?.level || 'UNKNOWN',
      truthScore: doc.bias?.score != null ? 100 - doc.bias.score : 0,
      claimsCount: Array.isArray(doc.factChecks) ? doc.factChecks.length : 0,
      views: doc.views || 0,
      sourceType: doc.sourceType,
      analyzedAt: doc.analyzedAt,
      createdAt: doc.createdAt,
    }));

    res.json({ success: true, count: items.length, sortBy, items });
  } catch (err) {
    console.error('[Unreel] Top analysed fetch error:', err.message);
    res.status(500).json({ error: 'Could not fetch top analysed reels.' });
  }
});

// ─── GET /api/stats ───────────────────────────────────────────────────────────
router.get('/stats', async (_req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database is not connected.' });
  }

  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [totalAnalyses, todayCount, avgBiasResult, biasTypeResult] = await Promise.all([
      AnalysisResult.countDocuments(),
      AnalysisResult.countDocuments({ createdAt: { $gte: todayStart } }),
      AnalysisResult.aggregate([
        { $group: { _id: null, avg: { $avg: '$bias.score' } } },
      ]),
      AnalysisResult.aggregate([
        { $match: { 'bias.level': { $exists: true, $ne: null } } },
        { $group: { _id: '$bias.level', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 },
      ]),
    ]);

    const avgBias = avgBiasResult[0]?.avg ?? 0;
    const commonBiasType = biasTypeResult[0]?._id || 'None';

    res.json({
      success: true,
      stats: {
        totalAnalyses,
        analysesToday: todayCount,
        averageBiasScore: Math.round(avgBias),
        averageTruthScore: Math.round(100 - avgBias),
        mostCommonBiasLevel: commonBiasType,
      },
    });
  } catch (err) {
    console.error('[Unreel] Stats fetch error:', err.message);
    res.status(500).json({ error: 'Could not fetch platform statistics.' });
  }
});

module.exports = router;
