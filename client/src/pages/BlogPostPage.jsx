import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Clock, Eye, Tag, ArrowRight, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function estimateReadTime(content) {
  const words = content.split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

export default function BlogPostPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    fetch(`/api/blogs/${slug}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setPost(data.post);
          setRelated(data.related || []);
        } else {
          setError(data.error || 'Post not found.');
        }
      })
      .catch(() => setError('Could not load this article.'))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="blogpost-page">
        <div className="blogpost-loading">
          <Loader2 className="spinner-icon" />
          <p>Loading article…</p>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="blogpost-page">
        <div className="blogpost-error">
          <h2>Article Not Found</h2>
          <p>{error || 'The article you are looking for does not exist.'}</p>
          <button className="back-btn" onClick={() => navigate('/blog')}>
            <ArrowLeft className="icon-sm" /> Back to Blog
          </button>
        </div>
      </div>
    );
  }

  const readTime = estimateReadTime(post.content);

  return (
    <div className="blogpost-page" id="blogpost-page">
      <article className="blogpost-article">
        {/* Header */}
        <div className="blogpost-header">
          <button className="back-btn" onClick={() => navigate('/blog')}>
            <ArrowLeft className="icon-sm" /> Back to Blog
          </button>

          <span className="blog-card-category blogpost-category">{post.category}</span>
          <h1 className="blogpost-title" id="blogpost-title">{post.title}</h1>

          <div className="blogpost-meta">
            <span className="blogpost-author">By {post.author}</span>
            <span className="blogpost-date">
              {new Date(post.createdAt).toLocaleDateString('en-US', {
                month: 'long', day: 'numeric', year: 'numeric',
              })}
            </span>
            <span className="blogpost-readtime">
              <Clock className="icon-sm" /> {readTime} min read
            </span>
            <span className="blogpost-views">
              <Eye className="icon-sm" /> {post.views?.toLocaleString()} views
            </span>
          </div>
        </div>

        {/* Featured Image */}
        {post.featuredImage && (
          <div className="blogpost-featured-image">
            <img src={post.featuredImage} alt={post.title} />
          </div>
        )}

        {/* Content */}
        <div className="blogpost-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {post.content}
          </ReactMarkdown>
        </div>

        {/* Tags */}
        {post.tags?.length > 0 && (
          <div className="blogpost-tags">
            <Tag className="icon-sm" />
            {post.tags.map((tag) => (
              <Link to={`/blog?tag=${tag}`} className="blogpost-tag" key={tag}>{tag}</Link>
            ))}
          </div>
        )}

        {/* Share */}
        <div className="blogpost-share">
          <span>Share this article:</span>
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(window.location.href)}`}
            target="_blank" rel="noopener noreferrer"
            className="blogpost-share-btn"
          >
            𝕏 Twitter
          </a>
          <a
            href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`}
            target="_blank" rel="noopener noreferrer"
            className="blogpost-share-btn"
          >
            LinkedIn
          </a>
          <button
            className="blogpost-share-btn"
            onClick={() => { navigator.clipboard.writeText(window.location.href); }}
          >
            Copy Link
          </button>
        </div>
      </article>

      {/* Related Posts */}
      {related.length > 0 && (
        <div className="blogpost-related">
          <h2>Related Articles</h2>
          <div className="blogpost-related-grid">
            {related.map((r) => (
              <Link to={`/blog/${r.slug}`} className="blogpost-related-card" key={r.id}>
                {r.featuredImage && (
                  <div className="blogpost-related-image">
                    <img src={r.featuredImage} alt={r.title} loading="lazy" />
                  </div>
                )}
                <div className="blogpost-related-body">
                  <span className="blog-card-category">{r.category}</span>
                  <h3>{r.title}</h3>
                  <span className="blog-card-read">
                    Read <ArrowRight className="icon-sm" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
