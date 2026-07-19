import { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Upload, ArrowLeft, ArrowRight, Link2, Film, FileText, CheckCircle2, Youtube, Instagram, Twitter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { apiUrl } from '../lib/api';

const LOADING_STEPS_URL = [
  { id: 'download',   label: 'Downloading video',     detail: 'Fetching from platform' },
  { id: 'transcribe', label: 'Transcribing audio',     detail: 'Converting speech to text' },
  { id: 'claims',     label: 'Extracting claims',      detail: 'Identifying factual statements' },
  { id: 'factcheck',  label: 'Fact-checking claims',   detail: 'Verifying against sources' },
  { id: 'bias',       label: 'Analyzing bias',         detail: 'Detecting bias patterns' },
];
const LOADING_STEPS_UPLOAD = [
  { id: 'transcribe', label: 'Transcribing audio',     detail: 'Converting speech to text' },
  { id: 'claims',     label: 'Extracting claims',      detail: 'Identifying factual statements' },
  { id: 'factcheck',  label: 'Fact-checking claims',   detail: 'Verifying against sources' },
  { id: 'bias',       label: 'Analyzing bias',         detail: 'Detecting bias patterns' },
];
const LOADING_STEPS_TEXT = [
  { id: 'claims',     label: 'Extracting claims',      detail: 'Identifying factual statements' },
  { id: 'factcheck',  label: 'Fact-checking claims',   detail: 'Verifying against sources' },
  { id: 'bias',       label: 'Analyzing bias',         detail: 'Detecting bias patterns' },
];

function getSteps(type) {
  if (type === 'url') return LOADING_STEPS_URL;
  if (type === 'text') return LOADING_STEPS_TEXT;
  return LOADING_STEPS_UPLOAD;
}

const PLATFORM_DETECT = [
  { pattern: /youtube\.com|youtu\.be/i, name: 'YouTube', color: '#ff4e4e', Icon: Youtube },
  { pattern: /instagram\.com|ddinstagram\.com/i, name: 'Instagram', color: '#e040fb', Icon: Instagram },
  { pattern: /tiktok\.com/i, name: 'TikTok', color: '#22d3ee', Icon: Film },
  { pattern: /twitter\.com|x\.com/i, name: 'Twitter/X', color: '#94a3b8', Icon: Twitter },
];

function detectUrlPlatform(url) {
  if (!url || url.length < 8) return null;
  for (const p of PLATFORM_DETECT) {
    if (p.pattern.test(url)) return p;
  }
  return null;
}

const TABS = [
  { key: 'url', label: 'Paste URL', Icon: Link2 },
  { key: 'upload', label: 'Upload Video', Icon: Upload },
  { key: 'text', label: 'Paste Transcript', Icon: FileText },
];

const fadeVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

export default function AnalyzePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { token } = useAuth();

  const initialParams = location.state;
  const [phase, setPhase] = useState(initialParams?.type ? 'loading' : 'input');
  const [activeTab, setActiveTab] = useState('url');
  const [url, setUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [analysisParams, setAnalysisParams] = useState(initialParams);
  const [error, setError] = useState('');
  const [canUpload, setCanUpload] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const tabRefs = useRef({});

  const loadingSteps = getSteps(analysisParams?.type);
  const detectedPlatform = useMemo(() => detectUrlPlatform(url), [url]);

  // Animated tab indicator position
  const [tabIndicator, setTabIndicator] = useState({ left: 0, width: 0 });
  useEffect(() => {
    const el = tabRefs.current[activeTab];
    if (el) {
      const parent = el.parentElement;
      const parentRect = parent.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      setTabIndicator({
        left: elRect.left - parentRect.left,
        width: elRect.width,
      });
    }
  }, [activeTab]);

  useEffect(() => {
    if (location.state?.switchToUpload) {
      setActiveTab('upload');
      setPhase('input');
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  // Loading step progression
  useEffect(() => {
    if (phase !== 'loading') return;
    setCurrentStep(0);
    const interval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= loadingSteps.length - 1) { clearInterval(interval); return prev; }
        return prev + 1;
      });
    }, 8000);
    return () => clearInterval(interval);
  }, [phase, loadingSteps]);

  // API call — uses AbortController so React StrictMode's
  // unmount/remount cycle aborts the first (stale) request.
  useEffect(() => {
    if (phase !== 'loading' || !analysisParams?.type) return;

    const controller = new AbortController();

    async function run() {
      try {
        let res;
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const signal = controller.signal;

        if (analysisParams.type === 'url') {
          res = await fetch(apiUrl('/api/analyze/url'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify({ url: analysisParams.url }),
            signal,
          });
        } else if (analysisParams.type === 'upload') {
          const form = new FormData();
          form.append('video', analysisParams.file);
          res = await fetch(apiUrl('/api/analyze/upload'), {
            method: 'POST',
            headers,
            body: form,
            signal,
          });
        } else if (analysisParams.type === 'text') {
          res = await fetch(apiUrl('/api/analyze/text'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify({ text: analysisParams.text }),
            signal,
          });
        }

        if (controller.signal.aborted) return;

        const data = await res.json();

        if (!res.ok || !data.success) {
          setError(data.error || 'Analysis failed.');
          setCanUpload(!!data.canUpload);
          setPhase('error');
          return;
        }

        if (data.resultId) {
          navigate(`/results/${data.resultId}`, { replace: true });
        } else {
          sessionStorage.setItem('unreel_last_result', JSON.stringify(data));
          navigate('/results/latest', { replace: true });
        }
      } catch (err) {
        if (err.name === 'AbortError') return; // StrictMode unmount — ignore
        setError('Could not connect to the server. Make sure the backend is running.');
        setPhase('error');
      }
    }

    run();
    return () => controller.abort();
  }, [phase, analysisParams, token, navigate]);

  function handleAnalyzeUrl(e) {
    e.preventDefault();
    if (!url.trim()) return;
    const params = { type: 'url', url: url.trim() };
    setAnalysisParams(params);
    setPhase('loading');
  }

  function handleAnalyzeUpload(e) {
    e.preventDefault();
    if (!selectedFile) return;
    const params = { type: 'upload', file: selectedFile };
    setAnalysisParams(params);
    setPhase('loading');
  }

  function handleAnalyzeText(e) {
    e.preventDefault();
    if (transcript.trim().length < 20) return;
    const params = { type: 'text', text: transcript.trim() };
    setAnalysisParams(params);
    setPhase('loading');
  }

  function handleDragOver(e) { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }
  function handleDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }
  function handleDrop(e) {
    e.preventDefault(); e.currentTarget.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && (file.type.startsWith('video/') || file.type.startsWith('audio/'))) setSelectedFile(file);
  }

  function goBackToInput() {
    setPhase('input');
    setError('');
    setCanUpload(false);
    setAnalysisParams(null);
  }

  // ─── RENDER ───
  return (
    <div className="analyze-page">
      <AnimatePresence mode="wait">
        {/* ─── INPUT PHASE ─── */}
        {phase === 'input' && (
          <motion.div key="input" className="analyze-page-wrapper" variants={fadeVariants} initial="initial" animate="animate" exit="exit">
            <div className="analyze-page-header">
              <h1 className="analyze-page-title">Analyze Content</h1>
              <p className="analyze-page-subtitle">
                Paste a URL, upload a video, or enter a transcript to fact-check
              </p>
            </div>

            <div className="analyze-card">
              {/* Tab bar with sliding indicator */}
              <div className="analyze-tabs" role="tablist">
                <div
                  className="analyze-tab-indicator"
                  style={{ left: tabIndicator.left, width: tabIndicator.width }}
                  aria-hidden="true"
                />
                {TABS.map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    ref={el => { tabRefs.current[key] = el; }}
                    className={`analyze-tab ${activeTab === key ? 'active' : ''}`}
                    role="tab"
                    aria-selected={activeTab === key}
                    onClick={() => setActiveTab(key)}
                  >
                    <Icon className="icon-sm" /> {label}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {activeTab === 'url' && (
                  <motion.form key="url-tab" onSubmit={handleAnalyzeUrl} variants={fadeVariants} initial="initial" animate="animate" exit="exit">
                    <div className="analyze-input-group">
                      <div className="analyze-input-wrapper">
                        <span className="analyze-input-icon">
                          {detectedPlatform
                            ? <detectedPlatform.Icon className="icon-sm" style={{ color: detectedPlatform.color }} />
                            : <Link2 className="icon-sm" />
                          }
                        </span>
                        <input
                          type="url" className="analyze-url-input" value={url}
                          onChange={e => setUrl(e.target.value)}
                          placeholder="https://www.instagram.com/reel/..."
                          aria-label="Video URL" required
                          id="analyze-url-input"
                        />
                        {detectedPlatform && (
                          <span className="analyze-platform-tag" style={{ color: detectedPlatform.color, borderColor: `${detectedPlatform.color}33` }}>
                            {detectedPlatform.name}
                          </span>
                        )}
                      </div>
                      <button type="submit" className="analyze-submit-btn" id="analyze-url-btn">
                        Analyze <ArrowRight className="icon-sm" />
                      </button>
                    </div>
                    <p className="analyze-hint">YouTube Shorts · Instagram Reels · TikTok · Twitter/X</p>
                  </motion.form>
                )}

                {activeTab === 'upload' && (
                  <motion.form key="upload-tab" onSubmit={handleAnalyzeUpload} variants={fadeVariants} initial="initial" animate="animate" exit="exit">
                    <div
                      className={`analyze-upload-area ${selectedFile ? 'has-file' : ''}`}
                      onClick={() => document.getElementById('file-input').click()}
                      onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                      role="button" tabIndex={0} aria-label="Upload video"
                    >
                      <div className="analyze-upload-icon">
                        {selectedFile
                          ? <CheckCircle2 className="icon-2xl" style={{ color: 'var(--true-color)' }} />
                          : <Film className="icon-2xl" />
                        }
                      </div>
                      {selectedFile ? (
                        <>
                          <p className="analyze-upload-filename">{selectedFile.name}</p>
                          <p className="analyze-upload-size">{(selectedFile.size / (1024 * 1024)).toFixed(1)} MB</p>
                        </>
                      ) : (
                        <>
                          <p className="analyze-upload-text">Click to upload or drag & drop</p>
                          <p className="analyze-upload-hint">MP4, MOV, AVI · Max 100 MB</p>
                        </>
                      )}
                    </div>
                    <input id="file-input" type="file" accept="video/*,audio/*" style={{ display: 'none' }}
                      onChange={e => setSelectedFile(e.target.files[0])} />
                    <button type="submit" className="analyze-submit-btn full-width" disabled={!selectedFile} id="analyze-upload-btn">
                      Analyze Video <ArrowRight className="icon-sm" />
                    </button>
                  </motion.form>
                )}

                {activeTab === 'text' && (
                  <motion.form key="text-tab" onSubmit={handleAnalyzeText} variants={fadeVariants} initial="initial" animate="animate" exit="exit">
                    <textarea
                      className="analyze-textarea"
                      value={transcript}
                      onChange={e => setTranscript(e.target.value)}
                      placeholder="Paste the video transcript or any text you want fact-checked…"
                      aria-label="Transcript text"
                      rows={6}
                      required
                      id="analyze-transcript-input"
                    />
                    <button type="submit" className="analyze-submit-btn full-width" disabled={transcript.trim().length < 20} id="analyze-text-btn">
                      Analyze Text <ArrowRight className="icon-sm" />
                    </button>
                    <p className="analyze-hint">Paste a video transcript, article snippet, or any content to fact-check.</p>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* ─── LOADING PHASE ─── */}
        {phase === 'loading' && (
          <motion.div key="loading" className="analyze-loading-card" variants={fadeVariants} initial="initial" animate="animate" exit="exit">
            <div className="analyze-loading-header">
              <div className="analyze-loading-spinner" aria-hidden="true">
                <svg viewBox="0 0 48 48" className="analyze-spinner-svg">
                  <circle cx="24" cy="24" r="20" fill="none" strokeWidth="3" stroke="rgba(255,255,255,0.08)" />
                  <circle cx="24" cy="24" r="20" fill="none" strokeWidth="3" stroke="url(#spinner-grad)" strokeLinecap="round"
                    strokeDasharray="90 125.6" className="analyze-spinner-arc" />
                  <defs>
                    <linearGradient id="spinner-grad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="var(--purple-1)" />
                      <stop offset="100%" stopColor="var(--cyan-1)" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <h2 className="analyze-loading-title">Analyzing your content</h2>
              <p className="analyze-loading-subtitle">This typically takes 30–60 seconds</p>
            </div>

            <div className="analyze-steps">
              {loadingSteps.map((s, i) => {
                const state = i < currentStep ? 'done' : i === currentStep ? 'active' : 'pending';
                return (
                  <motion.div
                    key={s.id}
                    className={`analyze-step ${state}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                  >
                    <div className="analyze-step-indicator">
                      {state === 'done' ? (
                        <CheckCircle2 className="icon-sm" />
                      ) : state === 'active' ? (
                        <div className="analyze-step-pulse" />
                      ) : (
                        <div className="analyze-step-dot" />
                      )}
                    </div>
                    <div className="analyze-step-content">
                      <span className="analyze-step-label">{s.label}</span>
                      <span className="analyze-step-detail">{s.detail}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Progress bar */}
            <div className="analyze-progress-track">
              <motion.div
                className="analyze-progress-fill"
                initial={{ width: '0%' }}
                animate={{ width: `${Math.min(((currentStep + 1) / loadingSteps.length) * 100, 95)}%` }}
                transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </motion.div>
        )}

        {/* ─── ERROR PHASE ─── */}
        {phase === 'error' && (
          <motion.div key="error" className="analyze-error-card" variants={fadeVariants} initial="initial" animate="animate" exit="exit" role="alert">
            <div className="analyze-error-icon-wrap">
              <AlertCircle className="icon-xl" />
            </div>
            <h2 className="analyze-error-title">Analysis Failed</h2>
            <p className="analyze-error-message">{error}</p>
            <div className="analyze-error-actions">
              {canUpload && (
                <button className="analyze-error-upload-btn" onClick={() => { setActiveTab('upload'); goBackToInput(); }}>
                  <Upload className="icon-sm" /> Upload file instead
                </button>
              )}
              <button className="analyze-error-retry-btn" onClick={goBackToInput}>
                <ArrowLeft className="icon-sm" /> Try Again
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
