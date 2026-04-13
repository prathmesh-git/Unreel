import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Upload, ArrowLeft, ArrowRight, Link2, Film, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiUrl } from '../lib/api';

const LOADING_STEPS_URL = [
  { id: 'download',   label: 'Downloading video' },
  { id: 'transcribe', label: 'Transcribing audio' },
  { id: 'claims',     label: 'Extracting claims' },
  { id: 'factcheck',  label: 'Fact-checking' },
  { id: 'bias',       label: 'Bias analysis' },
];
const LOADING_STEPS_UPLOAD = [
  { id: 'transcribe', label: 'Transcribing audio' },
  { id: 'claims',     label: 'Extracting claims' },
  { id: 'factcheck',  label: 'Fact-checking' },
  { id: 'bias',       label: 'Bias analysis' },
];
const LOADING_STEPS_TEXT = [
  { id: 'claims',     label: 'Extracting claims' },
  { id: 'factcheck',  label: 'Fact-checking' },
  { id: 'bias',       label: 'Bias analysis' },
];

function getSteps(type) {
  if (type === 'url') return LOADING_STEPS_URL;
  if (type === 'text') return LOADING_STEPS_TEXT;
  return LOADING_STEPS_UPLOAD;
}

export default function AnalyzePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { token } = useAuth();

  // Check if we were passed state directly (from an external link)
  const initialParams = location.state; // { type, url, file, text } or null

  // Phase: 'input' (show form) | 'loading' | 'error'
  const [phase, setPhase] = useState(initialParams?.type ? 'loading' : 'input');

  // Input form state
  const [activeTab, setActiveTab] = useState('url');
  const [url, setUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [transcript, setTranscript] = useState('');

  // Analysis state
  const [analysisParams, setAnalysisParams] = useState(initialParams);
  const [error, setError] = useState('');
  const [canUpload, setCanUpload] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const didRun = useRef(false);

  const loadingSteps = getSteps(analysisParams?.type);

  // Handle switchToUpload from error state
  useEffect(() => {
    if (location.state?.switchToUpload) {
      setActiveTab('upload');
      setPhase('input');
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  // Simulate loading step progression
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

  // Fire the API call when phase becomes 'loading'
  useEffect(() => {
    if (phase !== 'loading' || !analysisParams?.type || didRun.current) return;
    didRun.current = true;

    async function run() {
      try {
        let res;
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        if (analysisParams.type === 'url') {
          res = await fetch(apiUrl('/api/analyze/url'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify({ url: analysisParams.url }),
          });
        } else if (analysisParams.type === 'upload') {
          const form = new FormData();
          form.append('video', analysisParams.file);
          res = await fetch(apiUrl('/api/analyze/upload'), {
            method: 'POST',
            headers,
            body: form,
          });
        } else if (analysisParams.type === 'text') {
          res = await fetch(apiUrl('/api/analyze/text'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify({ text: analysisParams.text }),
          });
        }

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
      } catch {
        setError('Could not connect to the server. Make sure the backend is running.');
        setPhase('error');
      }
    }

    run();
  }, [phase, analysisParams, token, navigate]);

  // Form submission handlers
  function handleAnalyzeUrl(e) {
    e.preventDefault();
    if (!url.trim()) return;
    const params = { type: 'url', url: url.trim() };
    setAnalysisParams(params);
    didRun.current = false;
    setPhase('loading');
  }

  function handleAnalyzeUpload(e) {
    e.preventDefault();
    if (!selectedFile) return;
    const params = { type: 'upload', file: selectedFile };
    setAnalysisParams(params);
    didRun.current = false;
    setPhase('loading');
  }

  function handleAnalyzeText(e) {
    e.preventDefault();
    if (transcript.trim().length < 20) return;
    const params = { type: 'text', text: transcript.trim() };
    setAnalysisParams(params);
    didRun.current = false;
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
    didRun.current = false;
    setAnalysisParams(null);
  }

  // ─── INPUT PHASE ───
  if (phase === 'input') {
    return (
      <div className="analyze-page">
        <div className="analyze-page-wrapper">
          <div className="analyze-page-header">
            <h1 className="analyze-page-title">Analyze Content</h1>
            <p className="analyze-page-subtitle">
              Paste a URL, upload a video, or enter a transcript to fact-check
            </p>
          </div>

          <div className="analyze-card">
            <div className="tabs" role="tablist">
              <button
                className={`tab ${activeTab === 'url' ? 'active' : ''}`}
                role="tab" aria-selected={activeTab === 'url'}
                onClick={() => setActiveTab('url')}
              >
                <Link2 className="icon-sm" /> Paste URL
              </button>
              <button
                className={`tab ${activeTab === 'upload' ? 'active' : ''}`}
                role="tab" aria-selected={activeTab === 'upload'}
                onClick={() => setActiveTab('upload')}
              >
                <Upload className="icon-sm" /> Upload Video
              </button>
              <button
                className={`tab ${activeTab === 'text' ? 'active' : ''}`}
                role="tab" aria-selected={activeTab === 'text'}
                onClick={() => setActiveTab('text')}
              >
                <FileText className="icon-sm" /> Paste Transcript
              </button>
            </div>

            {activeTab === 'url' && (
              <form onSubmit={handleAnalyzeUrl}>
                <div className="input-group">
                  <div className="input-wrapper">
                    <span className="input-icon"><Link2 className="icon-sm" /></span>
                    <input
                      type="url" className="url-input" value={url}
                      onChange={e => setUrl(e.target.value)}
                      placeholder="https://www.instagram.com/reel/..."
                      aria-label="Video URL" required
                      id="analyze-url-input"
                    />
                  </div>
                  <button type="submit" className="analyze-btn" id="analyze-url-btn">
                    <span className="btn-content">Analyze URL <ArrowRight className="icon-sm" /></span>
                  </button>
                </div>
                <p className="input-hint">YouTube Shorts · Instagram Reels · TikTok · Twitter/X</p>
              </form>
            )}

            {activeTab === 'upload' && (
              <form onSubmit={handleAnalyzeUpload}>
                <div
                  className="upload-area"
                  onClick={() => document.getElementById('file-input').click()}
                  onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                  role="button" tabIndex={0} aria-label="Upload video"
                >
                  <div className="upload-area-icon"><Film className="icon-2xl" /></div>
                  <p className="upload-text">Click to upload or drag & drop</p>
                  <p className="upload-hint">MP4, MOV, AVI · Max 100MB</p>
                  {selectedFile && <p className="upload-selected">{selectedFile.name}</p>}
                </div>
                <input id="file-input" type="file" accept="video/*,audio/*" style={{ display: 'none' }}
                  onChange={e => setSelectedFile(e.target.files[0])} />
                <button type="submit" className="analyze-btn full-width" disabled={!selectedFile} id="analyze-upload-btn">
                  <span className="btn-content">Analyze Video <ArrowRight className="icon-sm" /></span>
                </button>
              </form>
            )}

            {activeTab === 'text' && (
              <form onSubmit={handleAnalyzeText}>
                <div className="input-group vertical">
                  <textarea
                    className="transcript-input"
                    value={transcript}
                    onChange={e => setTranscript(e.target.value)}
                    placeholder="Paste the video transcript or any text you want fact-checked…"
                    aria-label="Transcript text"
                    rows={6}
                    required
                    id="analyze-transcript-input"
                  />
                  <button type="submit" className="analyze-btn full-width" disabled={transcript.trim().length < 20} id="analyze-text-btn">
                    <span className="btn-content">Analyze Text <ArrowRight className="icon-sm" /></span>
                  </button>
                </div>
                <p className="input-hint">Paste a video transcript, article snippet, or any content to fact-check.</p>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── LOADING PHASE ───
  if (phase === 'loading') {
    return (
      <div className="analyze-page">
        <div className="analyze-card-page">
          <div className="loading-state">
            <div className="loading-animation" aria-hidden="true">
              <div className="loading-ring" />
              <div className="loading-ring delay-1" />
              <div className="loading-ring delay-2" />
            </div>
            <p className="loading-title">Analyzing your content...</p>
            <div className="loading-steps">
              {loadingSteps.map((s, i) => (
                <div key={s.id} className={`step ${i === currentStep ? 'active' : i < currentStep ? 'done' : ''}`}>
                  <span className="step-dot" aria-hidden="true" />
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── ERROR PHASE ───
  return (
    <div className="analyze-page">
      <div className="analyze-card-page">
        <div className="error-state" role="alert">
          <div className="error-icon"><AlertCircle className="icon-xl" /></div>
          <p className="error-message">{error}</p>
          {canUpload && (
            <button className="upload-fallback-btn" onClick={() => { setActiveTab('upload'); goBackToInput(); }}>
              <Upload className="icon-sm" /> Upload the video file instead
            </button>
          )}
          <button className="retry-btn" onClick={goBackToInput}>
            <ArrowLeft className="icon-sm" /> Try Again
          </button>
        </div>
      </div>
    </div>
  );
}
