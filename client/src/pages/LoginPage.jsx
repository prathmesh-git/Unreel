import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const googleButtonRef = useRef(null);
  const from = location.state?.from?.pathname || '/';

  const { login, googleLogin, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
    const google = window.google;
    if (!clientId || !google || !google.accounts?.id || !googleButtonRef.current) return;

    google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response) => {
        try {
          setError('');
          await googleLogin(response.credential);
          navigate(from, { replace: true });
        } catch (err) {
          setError(err.message || 'Google sign-in failed.');
        }
      },
    });

    google.accounts.id.renderButton(googleButtonRef.current, {
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      text: 'continue_with',
      width: 260,
    });
  }, [googleLogin, navigate, from]);

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

        <p className="auth-footnote">
          New here? <Link to="/register">Create an account</Link>
        </p>
      </section>
    </main>
  );
}
