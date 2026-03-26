import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const googleButtonRef = useRef(null);
  const from = location.state?.from?.pathname || '/';

  const { login, googleLogin, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [googleUnavailableReason, setGoogleUnavailableReason] = useState('');

  useEffect(() => {
    let active = true;

    async function initGoogleSignIn() {
      try {
        const configRes = await fetch('/api/auth/google-config');
        if (!configRes.ok) {
          throw new Error('Could not load Google sign-in configuration.');
        }

        const { enabled, clientId } = await configRes.json();
        const google = window.google;

        if (!active) return;

        if (!enabled || !clientId) {
          setGoogleUnavailableReason('Google sign-in is not configured on this server.');
          return;
        }
        if (!google || !google.accounts?.id || !googleButtonRef.current) {
          setGoogleUnavailableReason('Google sign-in failed to load. Refresh the page and try again.');
          return;
        }

        setGoogleUnavailableReason('');

        google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response) => {
            try {
              setError('');
              const result = await googleLogin(response.credential);
              if (result?.isNewUser) {
                showToast('Welcome to Unreel. Your account is ready.');
              }
              navigate(from, { replace: true });
            } catch (err) {
              setError(err.message || 'Google sign-in failed.');
            }
          },
        });

        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        google.accounts.id.renderButton(googleButtonRef.current, {
          theme: currentTheme === 'light' ? 'outline' : 'filled_black',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          width: 280,
        });
      } catch (_err) {
        if (!active) return;
        setGoogleUnavailableReason('Google sign-in failed to load. Refresh the page and try again.');
      }
    }

    initGoogleSignIn();

    return () => {
      active = false;
    };
  }, [googleLogin, navigate, from, showToast]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <h1 id="login-title">Sign in to Unreel</h1>
        <p className="auth-subtitle">Access your saved analysis history and personalize your workflow.</p>

        <form onSubmit={onSubmit} className="auth-form">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="Enter your password"
            required
          />

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="auth-btn" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="auth-divider"><span>or</span></div>
        <div className="google-button-wrap" ref={googleButtonRef} />
        {googleUnavailableReason && <p className="auth-helper-note">{googleUnavailableReason}</p>}

        <p className="auth-footnote">
          New here? <Link to="/register">Create an account</Link>
        </p>
      </section>
    </main>
  );
}
