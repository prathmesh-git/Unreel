import { useState, useEffect } from 'react';
import { Newspaper, ExternalLink, Clock, Loader2, RefreshCw } from 'lucide-react';

function formatTimeAgo(dateString) {
  if (!dateString) return '';
  const now = new Date();
  const published = new Date(dateString);
  const diffMs = now - published;
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHrs / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHrs > 0) return `${diffHrs}h ago`;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  return diffMins > 0 ? `${diffMins}m ago` : 'Just now';
}

export default function TrendingNewsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [imgErrors, setImgErrors] = useState({});

  useEffect(() => {
    fetchNews();
  }, []);

  function fetchNews() {
    setLoading(true);
    fetch('/api/news?limit=10')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setItems(data.items);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  function handleImgError(id) {
    setImgErrors((prev) => ({ ...prev, [id]: true }));
  }

  return (
    <div className="news-page" id="news-page">
      <div className="news-page-inner">
        <div className="news-page-header">
          <h1 id="news-page-title">
            <Newspaper className="icon-xl" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem', color: 'var(--false-color)' }} />
            Trending News
          </h1>
          <p className="news-page-subtitle">
            Latest news on misinformation, fact-checking, and media literacy — updated daily
          </p>
        </div>

        {loading ? (
          <div className="news-page-loading">
            <Loader2 className="spinner-icon" />
            <p>Fetching latest news…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="news-page-empty">
            <Newspaper className="icon-xl" style={{ color: 'var(--text-3)', marginBottom: '0.75rem' }} />
            <h2>No news available</h2>
            <p>We couldn't fetch any news articles right now. Try again later.</p>
            <button className="news-refresh-btn" onClick={fetchNews}>
              <RefreshCw className="icon-sm" /> Refresh
            </button>
          </div>
        ) : (
          <div className="news-page-grid">
            {items.map((item, i) => (
              <a
                className="news-page-card"
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ animationDelay: `${i * 0.06}s` }}
              >
                {/* Thumbnail */}
                <div className="news-page-card-thumb">
                  {item.image && !imgErrors[item.id] ? (
                    <img
                      src={item.image}
                      alt=""
                      loading="lazy"
                      onError={() => handleImgError(item.id)}
                    />
                  ) : (
                    <div className="news-page-card-thumb-placeholder">
                      <Newspaper className="icon-lg" />
                    </div>
                  )}
                </div>

                <div className="news-page-card-body">
                  <div className="news-page-card-source-row">
                    <span className="news-page-card-source">{item.source}</span>
                    <span className="news-page-card-time">
                      <Clock className="icon-xs" />
                      {formatTimeAgo(item.publishedAt)}
                    </span>
                  </div>
                  <h3 className="news-page-card-title">{item.title}</h3>
                  <p className="news-page-card-desc">{item.description}</p>
                  <span className="news-page-card-link">
                    Read Full Article <ExternalLink className="icon-xs" />
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
