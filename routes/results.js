const express = require('express');
const mongoose = require('mongoose');
const AnalysisResult = require('../models/AnalysisResult');

const router = express.Router();

// ─── GET /api/results ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'MongoDB is not connected.' });
  }

  const requestedLimit = Number(req.query.limit || 20);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 50)
    : 20;

  try {
    const docs = await AnalysisResult.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .select({
        'videoInfo.title': 1,
        'videoInfo.platform': 1,
        sourceType: 1,
        'bias.score': 1,
        'bias.level': 1,
        analyzedAt: 1,
        createdAt: 1,
        factChecks: 1,
      })
      .lean();

    const results = docs.map((doc) => ({
      id: doc._id,
      title: doc.videoInfo?.title || 'Video',
      platform: doc.videoInfo?.platform || 'Unknown',
      sourceType: doc.sourceType,
      biasScore: doc.bias?.score ?? 0,
      biasLevel: doc.bias?.level || 'UNKNOWN',
      claimsCount: Array.isArray(doc.factChecks) ? doc.factChecks.length : 0,
      analyzedAt: doc.analyzedAt,
      createdAt: doc.createdAt,
    }));

    res.json({ success: true, count: results.length, results });
  } catch (error) {
    console.error('[Unreel] Failed to fetch results:', error.message);
    res.status(500).json({ error: 'Could not fetch recent analysis results.' });
  }
});

// ─── GET /api/results/:id ─────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'MongoDB is not connected.' });
  }

  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid result ID.' });
  }

  try {
    const doc = await AnalysisResult.findById(id).lean();
    if (!doc) return res.status(404).json({ error: 'Result not found.' });

    res.json({
      success: true,
      result: {
        id: doc._id,
        videoInfo: doc.videoInfo,
        transcript: doc.transcript,
        captions: doc.captions,
        onScreenText: doc.onScreenText,
        factChecks: doc.factChecks,
        bias: doc.bias,
        sourceType: doc.sourceType,
        analyzedAt: doc.analyzedAt,
        createdAt: doc.createdAt,
      },
    });
  } catch (error) {
    console.error('[Unreel] Failed to fetch result by ID:', error.message);
    res.status(500).json({ error: 'Could not fetch analysis result.' });
  }
});

module.exports = router;
