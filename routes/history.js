const express = require('express');
const mongoose = require('mongoose');
const AnalysisResult = require('../models/AnalysisResult');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// ─── GET /api/history ─────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database is not connected.' });
  }

  const requestedLimit = Number(req.query.limit || 30);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 100)
    : 30;

  const page = Math.max(Number(req.query.page || 1), 1);
  const skip = (page - 1) * limit;

  try {
    const [docs, total] = await Promise.all([
      AnalysisResult.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select({
          'videoInfo.title': 1,
          'videoInfo.platform': 1,
          'videoInfo.url': 1,
          sourceType: 1,
          'bias.score': 1,
          'bias.level': 1,
          factChecks: 1,
          analyzedAt: 1,
          createdAt: 1,
        })
        .lean(),
      AnalysisResult.countDocuments({ userId: req.user._id }),
    ]);

    const results = docs.map((doc) => ({
      id: doc._id,
      title: doc.videoInfo?.title || 'Video',
      platform: doc.videoInfo?.platform || 'Unknown',
      url: doc.videoInfo?.url || null,
      sourceType: doc.sourceType,
      biasScore: doc.bias?.score ?? 0,
      biasLevel: doc.bias?.level || 'UNKNOWN',
      claimsCount: Array.isArray(doc.factChecks) ? doc.factChecks.length : 0,
      analyzedAt: doc.analyzedAt,
      createdAt: doc.createdAt,
    }));

    res.json({
      success: true,
      count: results.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      results,
    });
  } catch (err) {
    console.error('[Unreel] History fetch error:', err.message);
    res.status(500).json({ error: 'Could not fetch analysis history.' });
  }
});

// ─── DELETE /api/history/:id ─────────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database is not connected.' });
  }

  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid history item id.' });
  }

  try {
    const deleted = await AnalysisResult.findOneAndDelete({
      _id: id,
      userId: req.user._id,
    });

    if (!deleted) {
      return res.status(404).json({ error: 'History item not found.' });
    }

    return res.json({ success: true, deletedId: id });
  } catch (err) {
    console.error('[Unreel] History delete error:', err.message);
    return res.status(500).json({ error: 'Could not delete history item.' });
  }
});

// ─── DELETE /api/history ─────────────────────────────────────────────────────
router.delete('/', requireAuth, async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database is not connected.' });
  }

  try {
    const result = await AnalysisResult.deleteMany({ userId: req.user._id });
    return res.json({ success: true, deletedCount: result.deletedCount || 0 });
  } catch (err) {
    console.error('[Unreel] History clear-all error:', err.message);
    return res.status(500).json({ error: 'Could not clear history.' });
  }
});

module.exports = router;
