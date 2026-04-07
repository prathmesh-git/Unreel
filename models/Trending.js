const mongoose = require('mongoose');

const trendingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      default: '',
      maxlength: 500,
    },
    source: {
      type: String,
      default: 'Platform Analytics',
      trim: true,
    },
    truthScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    biasLevel: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium',
    },
    trendScore: {
      type: Number,
      default: 0,
      index: true,
    },
    category: {
      type: String,
      default: 'General',
    },
    analysisId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AnalysisResult',
      default: null,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

trendingSchema.index({ active: 1, trendScore: -1 });
trendingSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Trending', trendingSchema);
