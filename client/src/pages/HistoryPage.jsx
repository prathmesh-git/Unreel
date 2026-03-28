import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiUrl } from '../lib/api';

export default function HistoryPage() {
  const { token, user, isAuthenticated, loading, updateEmailPreferences } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [savingPref, setSavingPref] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const emailResultsEnabled = user?.preferences?.emailAnalysisResults !== false;

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

        const res = await fetch(apiUrl('/api/history?limit=30&page=1'), {
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

  async function onToggleEmailResults(e) {
    const nextValue = e.target.checked;
    try {
      setSavingPref(true);
      await updateEmailPreferences(nextValue);
      showToast(nextValue ? 'Analysis emails turned on.' : 'Analysis emails turned off.');
    } catch (err) {
      showToast(err.message || 'Could not update email setting.', { tone: 'error' });
    } finally {
      setSavingPref(false);
    }
  }

  function openDeleteDialog(item) {
    setPendingAction({
      type: 'single',
      itemId: item.id,
      title: item.title || 'this analysis',
    });
  }

  function openClearAllDialog() {
    setPendingAction({ type: 'all' });
  }

  function closeDialog() {
    if (actionLoading) return;
    setPendingAction(null);
  }

  async function onConfirmDelete() {
    if (!pendingAction || !token) return;

    try {
      setActionLoading(true);

      const endpoint = pendingAction.type === 'single'
        ? apiUrl(`/api/history/${pendingAction.itemId}`)
        : apiUrl('/api/history');

      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Could not delete history.');
      }

      if (pendingAction.type === 'single') {
        setItems((prev) => prev.filter((item) => item.id !== pendingAction.itemId));
        showToast('History item deleted.');
      } else {
        setItems([]);
        showToast('All history cleared.');
      }

      setPendingAction(null);
    } catch (err) {
      showToast(err.message || 'Could not delete history.', { tone: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <main className="history-page">
      <section className="history-wrap">
        <div className="history-title-row">
          <h1>Analysis History</h1>
          {!fetching && items.length > 0 && (
            <button className="history-danger-btn" type="button" onClick={openClearAllDialog}>
              Clear all history
            </button>
          )}
        </div>
        <p className="history-subtitle">Your previously saved Unreel analyses.</p>

        <div className="history-setting-card">
          <div>
            <h2>Email Result Settings</h2>
            <p>Send analysis result summaries to your account email after each completed analysis.</p>
          </div>
          <label className="email-setting-toggle" htmlFor="email-results-toggle">
            <input
              id="email-results-toggle"
              type="checkbox"
              checked={emailResultsEnabled}
              onChange={onToggleEmailResults}
              disabled={savingPref}
            />
            <span>{emailResultsEnabled ? 'On' : 'Off'}</span>
          </label>
        </div>

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
              <article className="history-card" key={item.id}>
                <Link className="history-card-link" to={`/results/${item.id}`}>
                  <h3>{item.title || 'Video'}</h3>
                  <p>{item.platform || 'Unknown'} · {new Date(item.createdAt).toLocaleString()}</p>
                  <p className="history-score">Bias score: {item.biasScore ?? 0}</p>
                </Link>
                <button
                  className="history-delete-btn"
                  type="button"
                  onClick={() => openDeleteDialog(item)}
                >
                  Delete
                </button>
              </article>
            ))}
          </div>
        )}

        {pendingAction && (
          <div className="history-dialog-backdrop" role="presentation" onClick={closeDialog}>
            <div
              className="history-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="history-dialog-title"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="history-dialog-title">
                {pendingAction.type === 'single' ? 'Delete this analysis?' : 'Clear entire history?'}
              </h2>
              <p>
                {pendingAction.type === 'single'
                  ? `This will permanently remove "${pendingAction.title}" from your history.`
                  : 'This will permanently remove all saved analyses from your account.'}
              </p>
              <div className="history-dialog-actions">
                <button type="button" className="history-dialog-cancel" onClick={closeDialog} disabled={actionLoading}>
                  Cancel
                </button>
                <button type="button" className="history-dialog-confirm" onClick={onConfirmDelete} disabled={actionLoading}>
                  {actionLoading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
