import { useState, useEffect } from 'react';
import { Search, ArrowRight, X } from 'lucide-react';
import { Link } from 'react-router-dom';

const CATEGORIES = [
  'All',
  'Fake News Analysis',
  'Social Media Trends',
  'AI & Misinformation',
  'Case Studies',
  'Platform Updates',
];

function BlogListCard({ post }) {
  return (
    <Link to={`/blog/${post.slug}`} className="blog-list-card" id={`blog-list-${post.slug}`}>
      {post.featuredImage && (
        <div className="blog-list-card-image">
          <img src={post.featuredImage} alt={post.title} loading="lazy" />
        </div>
      )}
      <div className="blog-list-card-body">
        <span className="blog-card-category">{post.category}</span>
        <h3 className="blog-list-card-title">{post.title}</h3>
        <p className="blog-list-card-excerpt">{post.excerpt}</p>
        <div className="blog-card-footer">
          <span className="blog-card-date">
            {new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <span className="blog-card-views">{post.views?.toLocaleString() || 0} views</span>
        </div>
      </div>
    </Link>
  );
}

export default function BlogPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 9 });
    if (category !== 'All') params.set('category', category);
    if (search) params.set('search', search);

    fetch(`/api/blogs?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setPosts(data.posts);
          setTotalPages(data.totalPages);
          setTotal(data.total);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, category, search]);

  function handleSearch(e) {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  function clearSearch() {
    setSearch('');
    setSearchInput('');
    setPage(1);
  }

  return (
    <div className="blog-page" id="blog-page">
      <div className="blog-page-inner">
        <div className="blog-page-header">
          <h1 id="blog-page-title">Insights & Blog</h1>
          <p className="blog-page-subtitle">
            Analysis, trends, and deep dives into misinformation and AI fact-checking
          </p>
        </div>

        {/* Search */}
        <form className="blog-search-form" onSubmit={handleSearch}>
          <div className="blog-search-wrapper">
            <Search className="icon-sm blog-search-icon" />
            <input
              type="text"
              className="blog-search-input"
              placeholder="Search articles…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search blog articles"
              id="blog-search"
            />
            {search && (
              <button type="button" className="blog-search-clear" onClick={clearSearch} aria-label="Clear search">
                <X className="icon-sm" />
              </button>
            )}
          </div>
        </form>

        {/* Categories */}
        <div className="blog-category-pills" role="tablist" aria-label="Blog categories">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`blog-category-pill ${category === cat ? 'active' : ''}`}
              onClick={() => { setCategory(cat); setPage(1); }}
              role="tab"
              aria-selected={category === cat}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Results info */}
        {search && (
          <p className="blog-results-info">
            {total} result{total !== 1 ? 's' : ''} for "{search}"
          </p>
        )}

        {/* Posts Grid */}
        {loading ? (
          <div className="blog-loading">Loading articles…</div>
        ) : posts.length === 0 ? (
          <div className="blog-empty">
            <h2>No articles found</h2>
            <p>{search ? `No results for "${search}". Try a different search.` : 'No blog posts in this category yet.'}</p>
          </div>
        ) : (
          <div className="blog-grid">
            {posts.map((post) => (
              <BlogListCard key={post.id} post={post} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="blog-pagination">
            <button
              className="blog-page-btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ← Previous
            </button>
            <span className="blog-page-info">
              Page {page} of {totalPages}
            </span>
            <button
              className="blog-page-btn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
