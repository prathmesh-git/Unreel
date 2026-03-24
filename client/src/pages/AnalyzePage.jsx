import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Upload, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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

  const params = location.state; // { type, url, file, text }
  const [status, setStatus]         = useState('loading'); // loading | error
  const [error, setError]           = useState('');
  const [canUpload, setCanUpload]   = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const didRun = useRef(false);

  const loadingSteps = getSteps(params?.type);

  // If someone navigates directly to /analyze without state, send them home
  useEffect(() => {
    if (!params || !params.type) {
      navigate('/', { replace: true });
    }
  }, [params, navigate]);

  // Simulate loading step progression
  useEffect(() => {
    if (status !== 'loading') return;
    setCurrentStep(0);
    const interval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= loadingSteps.length - 1) { clearInterval(interval); return prev; }
        return prev + 1;
      });
    }, 8000);
    return () => clearInterval(interval);
  }, [status, loadingSteps]);

  // Fire the API call on mount
  useEffect(() => {
    if (!params?.type || didRun.current) return;
    didRun.current = true;

    async function run() {
      try {
        let res;
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        if (params.type === 'url') {
          res = await fetch('/api/analyze/url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify({ url: params.url }),
          });
        } else if (params.type === 'upload') {
          const form = new FormData();
          form.append('video', params.file);
          res = await fetch('/api/analyze/upload', {
            method: 'POST',
            headers,
            body: form,
          });
        } else if (params.type === 'text') {
          res = await fetch('/api/analyze/text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify({ text: params.text }),
          });
        }

        const data = await res.json();

        if (!res.ok || !data.success) {
          setError(data.error || 'Analysis failed.');
          setCanUpload(!!data.canUpload);
          setStatus('error');
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
        setStatus('error');
      }
    }

    run();
  }, [params, token, navigate]);

  if (!params?.type) return null;

  return (
    <div className="analyze-page">
      <div className="analyze-card-page">
        {status === 'loading' && (
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
        )}

        {status === 'error' && (
          <div className="error-state" role="alert">
            <div className="error-icon"><AlertCircle className="icon-xl" /></div>
            <p className="error-message">{error}</p>
            {canUpload && (
              <button className="upload-fallback-btn" onClick={() => navigate('/', { state: { switchToUpload: true } })}>
                <Upload className="icon-sm" /> Upload the video file instead
              </button>
            )}
            <button className="retry-btn" onClick={() => navigate('/')}>
              <ArrowLeft className="icon-sm" /> Go Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
