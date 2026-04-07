import { useState, useEffect } from 'react';
import { Flame, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

function TruthScoreGauge({ score }) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const getColor = (s) => {
    if (s >= 70) return 'var(--true-color)';
    if (s >= 40) return 'var(--misleading-color)';
    return 'var(--false-color)';
  };

  return (
    <div className="truth-gauge">
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
        <circle
          cx="24" cy="24" r={radius} fill="none"
          stroke={getColor(score)} strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 24 24)"
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <span className="truth-gauge-value" style={{ color: getColor(score) }}>
        {score != null ? `${score}%` : '—'}
      </span>
    </div>
  );
}

function BiasLevelBadge({ level }) {
  const cls = {
    High: 'bias-badge-high',
    Medium: 'bias-badge-medium',
    Low: 'bias-badge-low',
    HIGH: 'bias-badge-high',
    MEDIUM: 'bias-badge-medium',
    LOW: 'bias-badge-low',
  }[level] || 'bias-badge-medium';

  return <span className={`bias-badge ${cls}`}>{level}</span>;
}

export default function TrendingSection() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/trending?limit=6')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setItems(data.items);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || items.length === 0) return null;

  return (
    <section className="trending-section" id="trending" aria-labelledby="trending-title">
      <div className="trending-header">
        <h2 id="trending-title" className="section-title">
          <Flame className="icon-lg" style={{ color: 'var(--false-color)', display: 'inline', verticalAlign: 'middle', marginRight: '0.4rem' }} />
          Trending Now
        </h2>
        <p className="section-subtitle">Viral content and misinformation topics being discussed right now</p>
      </div>
      <div className="trending-grid">
        {items.map((item, i) => (
          <div
            className="trending-card"
            key={item.id}
            style={{ animationDelay: `${i * 0.08}s` }}
          >
            <div className="trending-card-rank">#{i + 1}</div>
            <div className="trending-card-body">
              <h3 className="trending-card-title">{item.title}</h3>
              <p className="trending-card-desc">{item.description}</p>
              <div className="trending-card-meta">
                <div className="trending-card-scores">
                  <TruthScoreGauge score={item.truthScore} />
                  <div className="trending-card-score-labels">
                    <span>Truth Score: {item.truthScore != null ? `${item.truthScore}%` : 'N/A'}</span>
                    <BiasLevelBadge level={item.biasLevel} />
                  </div>
                </div>
                {item.analysisId && (
                  <Link to={`/results/${item.analysisId}`} className="trending-card-link">
                    View <ArrowRight className="icon-sm" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
