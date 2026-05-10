import { useState, useEffect } from 'react';
import { Newspaper, ExternalLink, Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

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

export default function TrendingSection() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [imgErrors, setImgErrors] = useState({});

  useEffect(() => {
    fetch('/api/news?limit=6')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setItems(data.items);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleImgError(id) {
    setImgErrors((prev) => ({ ...prev, [id]: true }));
  }

  if (loading || items.length === 0) return null;

  return (
    <section className="trending-section" id="trending" aria-labelledby="trending-title">
      <div className="trending-header">
        <h2 id="trending-title" className="section-title">
          <Newspaper className="icon-lg" style={{ color: 'var(--false-color)', display: 'inline', verticalAlign: 'middle', marginRight: '0.4rem' }} />
          Trending News
        </h2>
        <p className="section-subtitle">Latest news on misinformation, fact-checking, and media literacy — updated daily</p>
      </div>
      <div className="trending-grid">
        {items.map((item, i) => (
          <a
            className="trending-card"
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ animationDelay: `${i * 0.08}s` }}
          >
            {/* Thumbnail */}
            <div className="trending-card-thumb">
              {item.image && !imgErrors[item.id] ? (
                <img
                  src={item.image}
                  alt=""
                  loading="lazy"
                  onError={() => handleImgError(item.id)}
                />
              ) : (
                <div className="trending-card-thumb-placeholder">
                  <Newspaper className="icon-lg" />
                </div>
              )}
            </div>

            <div className="trending-card-body">
              <div className="trending-card-source-row">
                <span className="trending-card-source">{item.source}</span>
                <span className="trending-card-time">
                  <Clock className="icon-xs" />
                  {formatTimeAgo(item.publishedAt)}
                </span>
              </div>
              <h3 className="trending-card-title">{item.title}</h3>
              <p className="trending-card-desc">{item.description}</p>
              <span className="trending-card-read-more">
                Read Article <ExternalLink className="icon-xs" />
              </span>
            </div>
          </a>
        ))}
      </div>
      <div className="trending-section-cta">
        <Link to="/news" className="trending-view-all-btn" id="news-view-all">
          View All News <ArrowRight className="icon-sm" />
        </Link>
      </div>
    </section>
  );
}
