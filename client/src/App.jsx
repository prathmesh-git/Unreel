import { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import HowItWorks from './components/HowItWorks';
import Features from './components/Features';
import Footer from './components/Footer';
import ResultsOverlay from './components/ResultsOverlay';

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

export default function App() {
  const [activeTab, setActiveTab]       = useState('url');
  const [url, setUrl]                   = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [transcript, setTranscript]     = useState('');
  const [status, setStatus]             = useState('idle'); // idle | loading | error | results
  const [error, setError]               = useState('');
  const [canUpload, setCanUpload]       = useState(false);
  const [results, setResults]           = useState(null);
  const [currentStep, setCurrentStep]   = useState(0);
  const [loadingSteps, setLoadingSteps] = useState(LOADING_STEPS_UPLOAD);
  const requestSeqRef                    = useRef(0);

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

  async function analyzeUrl(e) {
    e.preventDefault();
    if (!url.trim() || status === 'loading') return;
    const reqId = ++requestSeqRef.current;
    setResults(null);
    setStatus('loading');
    setError('');
    setCanUpload(false);
    setLoadingSteps(LOADING_STEPS_URL);
    try {
      const res = await fetch('/api/analyze/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (reqId !== requestSeqRef.current) return;
      if (!res.ok || !data.success) {
        setError(data.error || 'Analysis failed.');
        setCanUpload(!!data.canUpload);
        setStatus('error');
        return;
      }
      setResults(data);
      setStatus('results');
    } catch {
      if (reqId !== requestSeqRef.current) return;
      setError('Could not connect to the server. Make sure the backend is running on port 3000.');
      setStatus('error');
    }
  }

  async function analyzeUpload(e) {
    e.preventDefault();
    if (!selectedFile || status === 'loading') return;
    const reqId = ++requestSeqRef.current;
    setResults(null);
    setStatus('loading');
    setError('');
    setCanUpload(false);
    setLoadingSteps(LOADING_STEPS_UPLOAD);
    const form = new FormData();
    form.append('video', selectedFile);
    try {
      const res = await fetch('/api/analyze/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (reqId !== requestSeqRef.current) return;
      if (!res.ok || !data.success) {
        setError(data.error || 'Analysis failed.');
        setStatus('error');
        return;
      }
      setResults(data);
      setStatus('results');
    } catch {
      if (reqId !== requestSeqRef.current) return;
      setError('Could not connect to the server.');
      setStatus('error');
    }
  }

  async function analyzeText(e) {
    e.preventDefault();
    if (transcript.trim().length < 20 || status === 'loading') return;
    const reqId = ++requestSeqRef.current;
    setResults(null);
    setStatus('loading');
    setError('');
    setCanUpload(false);
    setLoadingSteps(LOADING_STEPS_TEXT);
    try {
      const res = await fetch('/api/analyze/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: transcript }),
      });
      const data = await res.json();
      if (reqId !== requestSeqRef.current) return;
      if (!res.ok || !data.success) {
        setError(data.error || 'Analysis failed.');
        setStatus('error');
        return;
      }
      setResults(data);
      setStatus('results');
    } catch {
      if (reqId !== requestSeqRef.current) return;
      setError('Could not connect to the server.');
      setStatus('error');
    }
  }

  function reset() {
    requestSeqRef.current += 1;
    setStatus('idle');
    setError('');
    setUrl('');
    setSelectedFile(null);
    setTranscript('');
    setCanUpload(false);
    setCurrentStep(0);
    setResults(null);
  }

  function closeResults() {
    setResults(null);
    setStatus('idle');
    setUrl('');
    setSelectedFile(null);
    setTranscript('');
  }

  return (
    <>
      <div className="bg-orbs" aria-hidden="true">
        <div className="orb orb-1" /><div className="orb orb-2" /><div className="orb orb-3" />
      </div>

      <Navbar />

      <main>
        <Hero
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          url={url}
          setUrl={setUrl}
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
          transcript={transcript}
          setTranscript={setTranscript}
          status={status}
          error={error}
          canUpload={canUpload}
          currentStep={currentStep}
          loadingSteps={loadingSteps}
          onAnalyzeUrl={analyzeUrl}
          onAnalyzeUpload={analyzeUpload}
          onAnalyzeText={analyzeText}
          onReset={reset}
          onSwitchToUpload={() => { setActiveTab('upload'); reset(); }}
        />
        <HowItWorks />
        <Features />
      </main>

      <Footer />

      {status === 'results' && results && (
        <ResultsOverlay data={results} onClose={closeResults} />
      )}
    </>
  );
}
