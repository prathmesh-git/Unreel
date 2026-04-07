/**
 * Trending Seed Script — Run: node seed-trending.js
 * Populates the Trending collection with starter items.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Trending = require('./models/Trending');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI not set. Please check your .env file.');
  process.exit(1);
}

const trendingItems = [
  {
    title: '"5G causes cancer" reel spreading again',
    description: 'A debunked conspiracy theory about 5G towers causing health problems is resurging on Instagram Reels with new editing techniques.',
    source: 'Instagram Reels',
    truthScore: 8,
    biasLevel: 'High',
    trendScore: 95,
    category: 'Health Misinformation',
  },
  {
    title: '"AI can cure diabetes" — viral health claim',
    description: 'A viral TikTok claiming AI technology can cure diabetes overnight has been shared over 500K times. Medical experts have debunked this entirely.',
    source: 'TikTok',
    truthScore: 15,
    biasLevel: 'High',
    trendScore: 88,
    category: 'Health Misinformation',
  },
  {
    title: 'Deepfake political speech goes viral',
    description: 'An AI-generated video of a political figure making controversial statements has been viewed millions of times before being identified as synthetic.',
    source: 'Twitter/X',
    truthScore: 5,
    biasLevel: 'High',
    trendScore: 82,
    category: 'Deepfakes',
  },
  {
    title: '"Government banned this medicine" — fact check',
    description: 'Claims about a "banned miracle medicine" are circulating again. Our analysis shows this claim has been recycled from 2024 with new packaging.',
    source: 'YouTube Shorts',
    truthScore: 22,
    biasLevel: 'High',
    trendScore: 75,
    category: 'Health Misinformation',
  },
  {
    title: 'Climate change data manipulation accusations',
    description: 'Viral reels accusing climate scientists of fabricating data. Fact-checkers have verified the original research methodology is sound.',
    source: 'Instagram Reels',
    truthScore: 30,
    biasLevel: 'Medium',
    trendScore: 70,
    category: 'Science Misinformation',
  },
  {
    title: '"This food is toxic" — misleading nutrition reel',
    description: 'A reel claiming common everyday food items are "toxic" has garnered 800K views. The claims cherry-pick studies and ignore dose-response relationships.',
    source: 'Instagram Reels',
    truthScore: 25,
    biasLevel: 'High',
    trendScore: 68,
    category: 'Health Misinformation',
  },
  {
    title: 'AI-generated news anchor caught spreading disinfo',
    description: 'A synthetic AI-generated news anchor on YouTube has been identified spreading coordinated misinformation about financial markets.',
    source: 'YouTube',
    truthScore: 12,
    biasLevel: 'High',
    trendScore: 65,
    category: 'Deepfakes',
  },
  {
    title: 'Electoral misinformation surge detected',
    description: 'Across multiple platforms, coordinated campaigns are spreading false information about voting procedures. Multiple fact-checkers are flagging these.',
    source: 'Multiple Platforms',
    truthScore: 18,
    biasLevel: 'High',
    trendScore: 60,
    category: 'Political Misinformation',
  },
];

async function seed() {
  try {
    console.log('[Seed] Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('[Seed] Connected.');

    // Upsert each trending item
    for (const item of trendingItems) {
      await Trending.findOneAndUpdate(
        { title: item.title },
        item,
        { upsert: true, new: true }
      );
      console.log(`[Seed] ✓ ${item.title}`);
    }

    console.log(`\n[Seed] Done! ${trendingItems.length} trending items seeded.`);
  } catch (err) {
    console.error('[Seed] Error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
