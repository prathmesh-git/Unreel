import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Film, ExternalLink, BarChart2, ShieldCheck,
  CheckCircle2, XCircle, AlertTriangle, HelpCircle,
  FileText, ImageIcon, ChevronDown,
} from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────
export function getPlatformIcon(platform) {
  const icons = { YouTube: Film, Instagram: Film, TikTok: Film, Upload: Film };
  const Icon = icons[platform] || Film;
  return <Icon className="icon-lg" />;
}

export function getBiasColor(score) {
  if (score <= 25) return '#10b981';
  if (score <= 50) return '#f59e0b';
  if (score <= 75) return '#f97316';
  return '#ef4444';
}

export function getDomain(url) {
  try { return new URL(url).hostname.replace('www.', ''); } catch { return url.slice(0, 30); }
}

// ── Sub-components ────────────────────────────────────────────────
export function VerdictBadge({ verdict }) {
  const config = {
    TRUE:        { Icon: CheckCircle2,  cls: 'verdict-true' },
    FALSE:       { Icon: XCircle,       cls: 'verdict-false' },
    MISLEADING:  { Icon: AlertTriangle, cls: 'verdict-misleading' },
    UNVERIFIED:  { Icon: HelpCircle,    cls: 'verdict-unverified' },
  };
  const { Icon, cls } = config[verdict] || config.UNVERIFIED;
  return (
    <span className={`verdict-badge ${cls}`}>
      <Icon className="icon-sm" /> {verdict}
    </span>
  );
}

export function ClaimCard({ fc }) {
  return (
    <div className="claim-card">
      <div className="claim-header">
        <VerdictBadge verdict={fc.verdict} />
        <span className="claim-text">{fc.claim}</span>
      </div>
      <div className="claim-explanation">
        {fc.explanation}
        {fc.confidence && <span style={{ color: 'var(--text-3)' }}> · {fc.confidence} confidence</span>}
      </div>
      {fc.recency && (
        <div className="claim-explanation" style={{ marginTop: '0.35rem' }}>
          <strong>Time Check:</strong> {fc.recency}
          {fc.recencyReason ? ` - ${fc.recencyReason}` : ''}
        </div>
      )}
      {fc.sources?.length > 0 && (
        <div className="claim-sources">
          <div className="sources-label">Sources</div>
          <div className="source-links">
            {fc.sources.map((s, i) => (
              <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="source-link" title={s.snippet}>
                <ExternalLink className="icon-sm" /> {getDomain(s.url)}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function CollapsibleCard({ icon: Icon, label, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="transcript-card">
      <button className="transcript-toggle" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="toggle-left"><Icon className="icon-sm" /> {label}</span>
        <span className={`chevron ${open ? 'open' : ''}`}><ChevronDown className="icon-sm" /></span>
      </button>
      {open && <div className="transcript-body"><div className="transcript-text">{children}</div></div>}
    </div>
  );
}

export function BiasCard({ bias }) {
  const [barWidth, setBarWidth] = useState(0);
  useEffect(() => { const t = setTimeout(() => setBarWidth(bias.score), 100); return () => clearTimeout(t); }, [bias.score]);

  return (
    <div className="bias-card">
      <div className="bias-card-title"><BarChart2 className="icon-sm" /> Bias Analysis</div>
      <div className="bias-top">
        <div className="bias-score-big" style={{ color: getBiasColor(bias.score) }}>
          {bias.score}<span>/100</span>
        </div>
        <div className="bias-meta">
          <div className="bias-level" style={{ color: getBiasColor(bias.score) }}>{bias.level}</div>
          <div className="bias-type">{bias.type}</div>
        </div>
      </div>
      <div className="bias-bar-track">
        <div className="bias-bar-fill" style={{ width: `${barWidth}%` }} />
      </div>
      <div className="bias-indicator-labels"><span>Neutral</span><span>Medium</span><span>High Bias</span></div>
      <div className="bias-explanation">{bias.explanation}</div>
      {bias.indicators?.length > 0 && (
        <div className="bias-indicators">
          {bias.indicators.map((ind, i) => <span key={i} className="indicator-tag">{ind}</span>)}
        </div>
      )}
    </div>
  );
}

// ── Main Results Overlay ──────────────────────────────────────────
export default function ResultsOverlay({ data, onClose }) {
  const {
    videoInfo,
    transcript,
    onScreenText,
    factChecks = [],
    bias = { score: 0, level: 'UNKNOWN', type: 'Unknown', indicators: [], explanation: 'No bias analysis available.' },
    analyzedAt,
    resultId,
  } = data;

  // Close on Escape key
  const handleKey = useCallback(e => { if (e.key === 'Escape') onClose(); }, [onClose]);
  useEffect(() => { window.addEventListener('keydown', handleKey); return () => window.removeEventListener('keydown', handleKey); }, [handleKey]);

  return (
    <div className="results-overlay" role="dialog" aria-modal="true" aria-labelledby="results-title">
      <div className="results-panel">
        {/* Header */}
        <div className="results-header">
          <h1 id="results-title">Analysis Results</h1>
          <button className="back-btn" onClick={onClose}>
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
            {resultId && <p>Analysis ID: {resultId}</p>}
            {videoInfo?.url && (
              <a href={videoInfo.url} target="_blank" rel="noopener noreferrer" className="source-link" style={{ marginTop: '0.4rem' }}>
                <ExternalLink className="icon-sm" /> Original link
              </a>
            )}
          </div>
        </div>

        {/* On-Screen Text (if OCR found anything) */}
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
