import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import StatsSection from './components/StatsSection';
import TrendingSection from './components/TrendingSection';
import BlogSection from './components/BlogSection';
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
import BlogPage from './pages/BlogPage';
import BlogPostPage from './pages/BlogPostPage';
import TrendingNewsPage from './pages/TrendingNewsPage';
import MiniPortfolio from './components/MiniPortfolio';

function HomePage() {
  return (
    <>
      <main>
        <Hero />
        <StatsSection />
        <TrendingSection />
        <BlogSection />
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
      <MiniPortfolio />

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/analyze" element={<AnalyzePage />} />
        <Route path="/results/:id" element={<ResultsPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/telegram-bot" element={<TelegramBotPage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/blog/:slug" element={<BlogPostPage />} />
        <Route path="/news" element={<TrendingNewsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Footer />
    </>
  );
}
