import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function HistoryPage() {
  const { token, isAuthenticated, loading } = useAuth();
  const [items, setItems] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      if (!token) {
        setFetching(false);
        return;
      }

      try {
        setFetching(true);
        setError('');

        const res = await fetch('/api/history?limit=30&page=1', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (cancelled) return;
        if (!res.ok || !data.success) {
          setError(data.error || 'Could not load history.');
          return;
        }

        setItems(data.results || []);
      } catch {
        if (!cancelled) setError('Could not connect to the server.');
      } finally {
        if (!cancelled) setFetching(false);
      }
    }

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!loading && !isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: { pathname: '/history' } }} />;
  }

  return (
    <main className="history-page">
      <section className="history-wrap">
        <h1>Analysis History</h1>
        <p className="history-subtitle">Your previously saved Unreel analyses.</p>

        {fetching && <p className="history-meta">Loading your history...</p>}
        {error && <p className="auth-error">{error}</p>}

        {!fetching && !error && items.length === 0 && (
          <div className="history-empty">
            <h2>No saved analyses yet</h2>
            <p>Run a new analysis and it will appear here automatically.</p>
            <Link className="auth-btn" to="/">Analyze a video</Link>
          </div>
        )}

        {!fetching && !error && items.length > 0 && (
          <div className="history-grid">
            {items.map((item) => (
              <Link className="history-card" key={item.id} to={`/results/${item.id}`}>
                <h3>{item.title || 'Video'}</h3>
                <p>{item.platform || 'Unknown'} · {new Date(item.createdAt).toLocaleString()}</p>
                <p className="history-score">Bias score: {item.biasScore ?? 0}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
