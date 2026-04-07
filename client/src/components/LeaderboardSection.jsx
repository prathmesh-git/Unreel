import { useState, useEffect } from 'react';
import { Trophy, Eye, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const SORT_OPTIONS = [
  { key: 'views', label: 'Most Viewed' },
  { key: 'bias', label: 'Highest Bias' },
  { key: 'recent', label: 'Most Recent' },
];

function getMedalClass(rank) {
  if (rank === 1) return 'medal-gold';
  if (rank === 2) return 'medal-silver';
  if (rank === 3) return 'medal-bronze';
  return '';
}

function BiasBar({ score }) {
  const getColor = (s) => {
    if (s <= 25) return 'var(--true-color)';
    if (s <= 50) return 'var(--misleading-color)';
    if (s <= 75) return '#f97316';
    return 'var(--false-color)';
  };

  return (
    <div className="leaderboard-bias-bar">
      <div
        className="leaderboard-bias-fill"
        style={{ width: `${score}%`, background: getColor(score) }}
      />
    </div>
  );
}

export default function LeaderboardSection() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('views');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/top-analysed?limit=8&sort=${sortBy}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setItems(data.items);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sortBy]);

  if (!loading && items.length === 0) return null;

  return (
    <section className="leaderboard-section" id="leaderboard" aria-labelledby="leaderboard-title">
      <div className="leaderboard-header">
        <h2 id="leaderboard-title" className="section-title">
          <Trophy className="icon-lg" style={{ color: 'var(--misleading-color)', display: 'inline', verticalAlign: 'middle', marginRight: '0.4rem' }} />
          Most Analysed Reels
        </h2>
        <p className="section-subtitle">The most investigated content on our platform</p>
      </div>

      <div className="leaderboard-sort-group">
        {SORT_OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            className={`leaderboard-sort-btn ${sortBy === key ? 'active' : ''}`}
            onClick={() => setSortBy(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="leaderboard-loading">Loading leaderboard…</div>
      ) : (
        <div className="leaderboard-list">
          {items.map((item) => (
            <Link
              to={`/results/${item.id}`}
              className="leaderboard-item"
              key={item.id}
              style={{ animationDelay: `${(item.rank - 1) * 0.06}s` }}
            >
              <div className={`leaderboard-rank ${getMedalClass(item.rank)}`}>
                {item.rank <= 3 ? (
                  <span className="leaderboard-medal">{item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : '🥉'}</span>
                ) : (
                  <span className="leaderboard-rank-num">#{item.rank}</span>
                )}
              </div>
              <div className="leaderboard-info">
                <h3 className="leaderboard-title">{item.title}</h3>
                <div className="leaderboard-meta">
                  <span className="leaderboard-platform">{item.platform}</span>
                  <span className="leaderboard-claims">{item.claimsCount} claim{item.claimsCount !== 1 ? 's' : ''}</span>
                </div>
              </div>
              <div className="leaderboard-stats">
                <div className="leaderboard-views">
                  <Eye className="icon-sm" />
                  <span>{item.views.toLocaleString()}</span>
                </div>
                <div className="leaderboard-score-row">
                  <span className="leaderboard-truth">Truth: {item.truthScore}%</span>
                  <BiasBar score={item.biasScore} />
                  <span className={`leaderboard-bias-level bias-text-${item.biasLevel.toLowerCase()}`}>
                    {item.biasLevel}
                  </span>
                </div>
              </div>
              <ArrowRight className="icon-sm leaderboard-arrow" />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
