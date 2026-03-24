import { useEffect, useMemo, useState } from 'react';
import { Aperture, Menu, X, Sun, Moon } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const [theme, setTheme] = useState(localStorage.getItem('unreel_theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('unreel_theme', theme);
  }, [theme]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.hash]);

  const isHistory = useMemo(() => location.pathname === '/history', [location.pathname]);
  const isAnalyzing = useMemo(() => location.pathname === '/analyze' || location.pathname.startsWith('/results'), [location.pathname]);
  const isHome = useMemo(() => location.pathname === '/', [location.pathname]);

  function goHome() {
    setMobileOpen(false);
    navigate('/');
  }

  function goToSection(sectionId) {
    setMobileOpen(false);

    const scroll = () => {
      const el = document.getElementById(sectionId);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    if (location.pathname === '/') {
      scroll();
      return;
    }

    navigate('/');
    setTimeout(scroll, 150);
  }

  function onLogout() {
    logout();
    setMobileOpen(false);
    navigate('/');
  }

  return (
    <nav className="navbar" role="navigation" aria-label="Main navigation">
      <div className="nav-inner">
        <div className="nav-left">
          <button type="button" className="logo logo-btn" onClick={goHome}>
            <span className="logo-icon"><Aperture className="icon-lg" /></span>
            <span>Unreel</span>
          </button>

          <div className="nav-links">
            {isHome && (
              <>
                <button type="button" className="nav-link-btn" onClick={() => goToSection('how-it-works')}>How it Works</button>
                <button type="button" className="nav-link-btn" onClick={() => goToSection('features')}>Features</button>
              </>
            )}
            <button type="button" className={`nav-link-btn cta ${isHome ? 'active' : ''}`} onClick={goHome}>Analyze</button>
          </div>
        </div>

        <div className="nav-right">
          <button type="button" className="theme-toggle" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="icon" /> : <Moon className="icon" />}
          </button>
          <div className="auth-nav-actions">
            {!isAuthenticated && (
              <>
                <Link className="auth-nav-link" to="/login">Login</Link>
                <Link className="auth-nav-link primary" to="/register">Register</Link>
              </>
            )}

            {isAuthenticated && (
              <>
                <Link className={`auth-nav-link ${isHistory ? 'active' : ''}`} to="/history">History</Link>
                <span className="auth-nav-user">
                  {user?.avatar ? (
                    <span className="auth-nav-avatar-frame">
                      <img src={user.avatar} alt="User avatar" className="auth-nav-avatar" />
                    </span>
                  ) : (
                    <span className="auth-nav-avatar-frame auth-nav-avatar-fallback">
                      {(user?.name || user?.email || 'U').slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="auth-nav-user-name">{user?.name || user?.email || 'User'}</span>
                </span>
                <button type="button" className="auth-nav-link auth-nav-link-logout" onClick={onLogout}>Logout</button>
              </>
            )}
          </div>

          <button
            type="button"
            className="mobile-menu-toggle"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((prev) => !prev)}
          >
            {mobileOpen ? <X className="icon-lg" /> : <Menu className="icon-lg" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="mobile-nav-panel">
          <button type="button" className="mobile-nav-link" onClick={goHome}>Analyze</button>
          {isHome && (
            <>
              <button type="button" className="mobile-nav-link" onClick={() => goToSection('how-it-works')}>How it Works</button>
              <button type="button" className="mobile-nav-link" onClick={() => goToSection('features')}>Features</button>
            </>
          )}

          {!isAuthenticated && (
            <div className="mobile-auth-links">
              <Link className="auth-nav-link" to="/login">Login</Link>
              <Link className="auth-nav-link primary" to="/register">Register</Link>
            </div>
          )}

          {isAuthenticated && (
            <div className="mobile-auth-links">
              <Link className={`auth-nav-link ${isHistory ? 'active' : ''}`} to="/history">History</Link>
              <button type="button" className="auth-nav-link auth-nav-link-logout" onClick={onLogout}>Logout</button>
            </div>
          )}
        </div>
      )}

      {mobileOpen && <button type="button" className="mobile-nav-backdrop" onClick={() => setMobileOpen(false)} aria-label="Close menu" />}
    </nav>
  );
}
