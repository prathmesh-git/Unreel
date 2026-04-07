const express = require('express');
const mongoose = require('mongoose');
const Blog = require('../models/Blog');

const router = express.Router();

// ─── GET /api/blogs ───────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database is not connected.' });
  }

  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit || 12), 1), 50);
  const skip = (page - 1) * limit;
  const category = req.query.category || null;
  const tag = req.query.tag || null;
  const search = req.query.search || null;

  try {
    const filter = { published: true };
    if (category) filter.category = category;
    if (tag) filter.tags = tag;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { excerpt: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ];
    }

    const [docs, total] = await Promise.all([
      Blog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-content')
        .lean(),
      Blog.countDocuments(filter),
    ]);

    const posts = docs.map((doc) => ({
      id: doc._id,
      title: doc.title,
      slug: doc.slug,
      excerpt: doc.excerpt,
      author: doc.author,
      category: doc.category,
      tags: doc.tags,
      featuredImage: doc.featuredImage,
      featured: doc.featured,
      views: doc.views,
      createdAt: doc.createdAt,
    }));

    res.json({
      success: true,
      count: posts.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      posts,
    });
  } catch (err) {
    console.error('[Unreel] Blog list error:', err.message);
    res.status(500).json({ error: 'Could not fetch blog posts.' });
  }
});

// ─── GET /api/blogs/categories ────────────────────────────────────────────────
router.get('/categories', async (_req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database is not connected.' });
  }

  try {
    const categories = await Blog.aggregate([
      { $match: { published: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.json({
      success: true,
      categories: categories.map((c) => ({ name: c._id, count: c.count })),
    });
  } catch (err) {
    console.error('[Unreel] Blog categories error:', err.message);
    res.status(500).json({ error: 'Could not fetch categories.' });
  }
});

// ─── GET /api/blogs/featured ──────────────────────────────────────────────────
router.get('/featured', async (_req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database is not connected.' });
  }

  try {
    // Try to find a manually featured post first, then fall back to most viewed
    let post = await Blog.findOne({ published: true, featured: true })
      .sort({ createdAt: -1 })
      .select('-content')
      .lean();

    if (!post) {
      post = await Blog.findOne({ published: true })
        .sort({ views: -1 })
        .select('-content')
        .lean();
    }

    if (!post) {
      return res.json({ success: true, post: null });
    }

    res.json({
      success: true,
      post: {
        id: post._id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        author: post.author,
        category: post.category,
        tags: post.tags,
        featuredImage: post.featuredImage,
        views: post.views,
        createdAt: post.createdAt,
      },
    });
  } catch (err) {
    console.error('[Unreel] Featured blog error:', err.message);
    res.status(500).json({ error: 'Could not fetch featured blog post.' });
  }
});

// ─── GET /api/blogs/:slug ─────────────────────────────────────────────────────
router.get('/:slug', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database is not connected.' });
  }

  const { slug } = req.params;

  try {
    const post = await Blog.findOneAndUpdate(
      { slug, published: true },
      { $inc: { views: 1 } },
      { new: true }
    ).lean();

    if (!post) {
      return res.status(404).json({ error: 'Blog post not found.' });
    }

    // Fetch related posts (same category, excluding current)
    const related = await Blog.find({
      published: true,
      category: post.category,
      _id: { $ne: post._id },
    })
      .sort({ createdAt: -1 })
      .limit(3)
      .select('-content')
      .lean();

    res.json({
      success: true,
      post: {
        id: post._id,
        title: post.title,
        slug: post.slug,
        content: post.content,
        excerpt: post.excerpt,
        author: post.author,
        category: post.category,
        tags: post.tags,
        featuredImage: post.featuredImage,
        views: post.views,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
      },
      related: related.map((r) => ({
        id: r._id,
        title: r.title,
        slug: r.slug,
        excerpt: r.excerpt,
        category: r.category,
        featuredImage: r.featuredImage,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    console.error('[Unreel] Blog fetch error:', err.message);
    res.status(500).json({ error: 'Could not fetch blog post.' });
  }
});

module.exports = router;
