import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import HowItWorks from './components/HowItWorks';
import Features from './components/Features';
import Footer from './components/Footer';
import ResultsPage from './components/ResultsPage';
import AnalyzePage from './pages/AnalyzePage';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HistoryPage from './pages/HistoryPage';
import TelegramBotPage from './pages/TelegramBotPage';

function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab]       = useState('url');
  const [url, setUrl]                   = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [transcript, setTranscript]     = useState('');

  // If redirected from AnalyzePage with switchToUpload
  useEffect(() => {
    if (location.state?.switchToUpload) {
      setActiveTab('upload');
      // Clear the state so it doesn't re-trigger
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  function analyzeUrl(e) {
    e.preventDefault();
    if (!url.trim()) return;
    navigate('/analyze', { state: { type: 'url', url: url.trim() } });
  }

  function analyzeUpload(e) {
    e.preventDefault();
    if (!selectedFile) return;
    navigate('/analyze', { state: { type: 'upload', file: selectedFile } });
  }

  function analyzeText(e) {
    e.preventDefault();
    if (transcript.trim().length < 20) return;
    navigate('/analyze', { state: { type: 'text', text: transcript.trim() } });
  }

  return (
    <>
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
          onAnalyzeUrl={analyzeUrl}
          onAnalyzeUpload={analyzeUpload}
          onAnalyzeText={analyzeText}
        />
        <HowItWorks />
        <Features />
      </main>
    </>
  );
}

export default function App() {
  const { loading } = useAuth();

  if (loading) {
    return null;
  }

  return (
    <>
      <div className="bg-orbs" aria-hidden="true">
        <div className="orb orb-1" /><div className="orb orb-2" /><div className="orb orb-3" />
      </div>

      <Navbar />

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/analyze" element={<AnalyzePage />} />
        <Route path="/results/:id" element={<ResultsPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/telegram-bot" element={<TelegramBotPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Footer />
    </>
  );
}
