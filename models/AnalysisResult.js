const mongoose = require('mongoose');

const sourceSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    title: { type: String },
    snippet: { type: String },
  },
  { _id: false }
);

const factCheckSchema = new mongoose.Schema(
  {
    claim: { type: String, required: true },
    verdict: {
      type: String,
      enum: ['TRUE', 'FALSE', 'MISLEADING', 'UNVERIFIED'],
      default: 'UNVERIFIED',
    },
    explanation: { type: String, default: '' },
    confidence: { type: String, default: 'LOW' },
    sources: { type: [sourceSchema], default: [] },
  },
  { _id: false }
);

const biasSchema = new mongoose.Schema(
  {
    score: { type: Number, min: 0, max: 100, default: 50 },
    level: { type: String, default: 'MEDIUM' },
    type: { type: String, default: 'Unknown' },
    indicators: { type: [String], default: [] },
    explanation: { type: String, default: '' },
  },
  { _id: false }
);

const analysisResultSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    videoInfo: {
      title: { type: String, default: 'Video' },
      platform: { type: String, default: 'Unknown' },
      url: { type: String, default: null },
    },
    transcript: { type: String, default: '' },
    captions: { type: String, default: '' },
    onScreenText: { type: String, default: null },
    factChecks: { type: [factCheckSchema], default: [] },
    bias: { type: biasSchema, required: true },
    sourceType: {
      type: String,
      enum: ['url', 'upload', 'text'],
      default: 'url',
    },
    analyzedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

analysisResultSchema.index({ createdAt: -1 });
analysisResultSchema.index({ 'videoInfo.platform': 1, createdAt: -1 });
analysisResultSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('AnalysisResult', analysisResultSchema);
