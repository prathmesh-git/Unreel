import { useState, useEffect } from 'react';
import { ArrowRight, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

function BlogCard({ post }) {
  return (
    <Link to={`/blog/${post.slug}`} className="blog-card" id={`blog-card-${post.slug}`}>
      {post.featuredImage && (
        <div className="blog-card-image">
          <img src={post.featuredImage} alt={post.title} loading="lazy" />
        </div>
      )}
      <div className="blog-card-body">
        <span className="blog-card-category">{post.category}</span>
        <h3 className="blog-card-title">{post.title}</h3>
        <p className="blog-card-excerpt">{post.excerpt}</p>
        <div className="blog-card-footer">
          <span className="blog-card-date">
            {new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <span className="blog-card-read">
            Read <ArrowRight className="icon-sm" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function BlogSection() {
  const [posts, setPosts] = useState([]);
  const [featured, setFeatured] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/blogs?limit=3').then((r) => r.json()),
      fetch('/api/blogs/featured').then((r) => r.json()),
    ])
      .then(([listData, featuredData]) => {
        if (listData.success) setPosts(listData.posts);
        if (featuredData.success) setFeatured(featuredData.post);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || (posts.length === 0 && !featured)) return null;

  return (
    <section className="blog-section" id="blog" aria-labelledby="blog-title">
      <div className="blog-section-header">
        <h2 id="blog-title" className="section-title">
          <BookOpen className="icon-lg" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.4rem' }} />
          Insights & Blog
        </h2>
        <p className="section-subtitle">Deep dives into misinformation, social media trends, and AI analysis</p>
      </div>

      <div className="blog-section-grid">
        {/* Featured Article */}
        {featured && (
          <Link to={`/blog/${featured.slug}`} className="blog-featured-card" id="blog-featured">
            {featured.featuredImage && (
              <div className="blog-featured-image">
                <img src={featured.featuredImage} alt={featured.title} loading="lazy" />
                <div className="blog-featured-overlay" />
              </div>
            )}
            <div className="blog-featured-content">
              <span className="blog-card-category">{featured.category}</span>
              <h3 className="blog-featured-title">{featured.title}</h3>
              <p className="blog-featured-excerpt">{featured.excerpt}</p>
              <span className="blog-card-read">
                Read Article <ArrowRight className="icon-sm" />
              </span>
            </div>
          </Link>
        )}

        {/* Latest Posts */}
        <div className="blog-latest-posts">
          {posts
            .filter((p) => !featured || p.slug !== featured.slug)
            .slice(0, 3)
            .map((post) => (
              <BlogCard key={post.id} post={post} />
            ))}
        </div>
      </div>

      <div className="blog-section-cta">
        <Link to="/blog" className="blog-view-all-btn" id="blog-view-all">
          View All Articles <ArrowRight className="icon-sm" />
        </Link>
      </div>
    </section>
  );
}
