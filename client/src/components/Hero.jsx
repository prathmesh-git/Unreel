import { useState, useRef } from 'react';
import { ArrowRight, ShieldCheck, Zap, Globe, BarChart2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PLATFORM_ICONS = {
  youtube: (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
      <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 0 0 .5 6.19C0 8.04 0 12 0 12s0 3.96.5 5.81a3.02 3.02 0 0 0 2.12 2.14C4.46 20.5 12 20.5 12 20.5s7.54 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14C24 15.96 24 12 24 12s0-3.96-.5-5.81zM9.75 15.52V8.48L15.84 12l-6.09 3.52z" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
      <circle cx="12" cy="12" r="4"/>
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none"/>
    </svg>
  ),
  tiktok: (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.3 6.3 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.15 8.15 0 0 0 4.77 1.52V6.77a4.85 4.85 0 0 1-1-.08z"/>
    </svg>
  ),
  twitter: (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  ),
};

const HIGHLIGHTS = [
  { Icon: ShieldCheck, title: 'Fact Verdicts', desc: 'TRUE / FALSE / MISLEADING verdicts sourced from WHO, Reuters & more.' },
  { Icon: BarChart2, title: 'Bias Detection', desc: 'AI-powered bias scoring on a 0-100 scale with type identification.' },
  { Icon: Globe, title: 'Multi-Platform', desc: 'Works with YouTube Shorts, Instagram Reels, TikTok & Twitter/X.' },
  { Icon: Zap, title: 'Under 60 Seconds', desc: 'Paste a link and get a full analysis report in under a minute.' },
];

export default function Hero() {
  const navigate = useNavigate();
  const [transitioning, setTransitioning] = useState(false);
  const btnRef = useRef(null);
  const [ripplePos, setRipplePos] = useState({ x: '50%', y: '50%' });

  function handleCtaClick() {
    if (transitioning) return;
    const btn = btnRef.current;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setRipplePos({
        x: `${rect.left + rect.width / 2}px`,
        y: `${rect.top + rect.height / 2}px`,
      });
    }
    setTransitioning(true);
    setTimeout(() => navigate('/analyze'), 650);
  }

  return (
    <>
      {/* Page transition overlay */}
      {transitioning && (
        <div
          className="page-transition-overlay"
          style={{ '--ripple-x': ripplePos.x, '--ripple-y': ripplePos.y }}
          aria-hidden="true"
        >
          <div className="page-transition-ripple" />
        </div>
      )}

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-badge">
          <span className="pulse-dot" aria-hidden="true" />
          AI-Powered Fact Checking
        </div>

        <h1 id="hero-title" className="hero-title">
          Reveal the Truth<br />
          <span className="gradient-text">Behind Every Reel</span>
        </h1>

        <p className="hero-subtitle">
          Paste a URL, upload a video, or add a transcript.<br />
          Our AI analyzes claims, checks facts, and detects bias — in seconds.
        </p>

        {/* CTA Button */}
        <button
          ref={btnRef}
          className={`hero-cta-btn ${transitioning ? 'cta-pressed' : ''}`}
          onClick={handleCtaClick}
          id="hero-cta"
        >
          <span className="hero-cta-content">
            Start Analyzing
            <ArrowRight className="icon-sm" />
          </span>
          <span className="hero-cta-glow" aria-hidden="true" />
        </button>

        {/* Platform badges */}
        <div className="platform-badges" aria-label="Supported platforms">
          <span className="platform-badge yt">{PLATFORM_ICONS.youtube} YouTube</span>
          <span className="platform-badge ig">{PLATFORM_ICONS.instagram} Instagram</span>
          <span className="platform-badge tt">{PLATFORM_ICONS.tiktok} TikTok</span>
          <span className="platform-badge tw">{PLATFORM_ICONS.twitter} Twitter/X</span>
        </div>

        {/* Feature Highlights */}
        <div className="hero-highlights">
          {HIGHLIGHTS.map(({ Icon, title, desc }) => (
            <div className="hero-highlight-card" key={title}>
              <div className="hero-highlight-icon">
                <Icon className="icon-lg" />
              </div>
              <div>
                <h3 className="hero-highlight-title">{title}</h3>
                <p className="hero-highlight-desc">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
