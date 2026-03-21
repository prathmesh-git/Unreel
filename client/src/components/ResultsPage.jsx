import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Film, ExternalLink, BarChart2, ShieldCheck,
  FileText, ImageIcon, Loader2,
} from 'lucide-react';
import {
  getPlatformIcon, getBiasColor, getDomain,
  VerdictBadge, ClaimCard, CollapsibleCard, BiasCard,
} from './ResultsOverlay';

export default function ResultsPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    let cancelled = false;

    async function fetchResult() {
      setLoading(true);
      setError('');

      // Handle sessionStorage fallback for results without a MongoDB ID
      if (id === 'latest') {
        try {
          const stored = sessionStorage.getItem('unreel_last_result');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (!cancelled) {
              setResult({
                videoInfo: parsed.videoInfo,
                transcript: parsed.transcript,
                onScreenText: parsed.onScreenText,
                factChecks: parsed.factChecks,
                bias: parsed.bias,
                analyzedAt: parsed.analyzedAt,
              });
            }
          } else {
            if (!cancelled) setError('No recent analysis found. Please run an analysis first.');
          }
        } catch {
          if (!cancelled) setError('Could not load saved results.');
        } finally {
          if (!cancelled) setLoading(false);
        }
        return;
      }

      try {
        const res = await fetch(`/api/results/${id}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.success) {
          setError(data.error || 'Result not found.');
          return;
        }
        setResult(data.result);
      } catch {
        if (!cancelled) setError('Could not connect to the server.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchResult();
    return () => { cancelled = true; };
  }, [id]);

  const handleKey = useCallback(e => {
    if (e.key === 'Escape') navigate('/');
  }, [navigate]);
  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  // ── Loading state ────────────────────────────────────────────
  if (loading) {
    return (
      <div className="results-page">
        <div className="results-panel">
          <div className="results-loading">
            <Loader2 className="spinner-icon" />
            <p>Loading analysis results…</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────
  if (error || !result) {
    return (
      <div className="results-page">
        <div className="results-panel">
          <div className="results-error">
            <h2>Result Not Found</h2>
            <p>{error || 'The analysis result you are looking for does not exist.'}</p>
            <button className="back-btn" onClick={() => navigate('/')}>
              <ArrowLeft className="icon-sm" /> Analyze Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Result display ──────────────────────────────────────────
  const {
    videoInfo,
    transcript,
    onScreenText,
    factChecks = [],
    bias = { score: 0, level: 'UNKNOWN', type: 'Unknown', indicators: [], explanation: 'No bias analysis available.' },
    analyzedAt,
  } = result;

  return (
    <div className="results-page">
      <div className="results-panel">
        {/* Header */}
        <div className="results-header">
          <h1 id="results-title">Analysis Results</h1>
          <button className="back-btn" onClick={() => navigate('/')}>
            <ArrowLeft className="icon-sm" /> Analyze Another
          </button>
        </div>

        {/* Video Info */}
        <div className="video-info-card">
          <div className="video-thumbnail-placeholder">{getPlatformIcon(videoInfo?.platform)}</div>
          <div className="video-meta">
            <h3>{videoInfo?.title || 'Video'}</h3>
            <p>{videoInfo?.platform} · {new Date(analyzedAt).toLocaleTimeString()}</p>
            {videoInfo?.contentDate && <p>Content date detected: {videoInfo.contentDate}</p>}
            <p>Analysis ID: {id}</p>
            {videoInfo?.url && (
              <a href={videoInfo.url} target="_blank" rel="noopener noreferrer" className="source-link" style={{ marginTop: '0.4rem' }}>
                <ExternalLink className="icon-sm" /> Original link
              </a>
            )}
          </div>
        </div>

        {/* On-Screen Text */}
        {onScreenText && (
          <CollapsibleCard icon={ImageIcon} label="On-Screen Text Detected">
            {onScreenText}
          </CollapsibleCard>
        )}

        {/* Bias Meter */}
        <BiasCard bias={bias} />

        {/* Fact Checks */}
        <div>
          <div className="factcheck-section-title">
            <ShieldCheck className="icon" />
            Fact Check Results
            <span className="factcheck-count">({factChecks.length} claim{factChecks.length !== 1 ? 's' : ''} found)</span>
          </div>
          {factChecks.length === 0 && (
            <div className="claim-card">
              <div className="claim-explanation">
                No verifiable factual statements were detected in this transcript. This usually means the video is mostly opinion, rhetoric, or emotional commentary rather than checkable factual claims.
              </div>
            </div>
          )}
          {factChecks.map((fc, i) => <ClaimCard key={i} fc={fc} />)}
        </div>

        {/* Transcript */}
        <CollapsibleCard icon={FileText} label="View Transcript">
          "{transcript}"
        </CollapsibleCard>
      </div>
    </div>
  );
}
