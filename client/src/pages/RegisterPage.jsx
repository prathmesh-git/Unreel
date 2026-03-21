import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const googleButtonRef = useRef(null);
  const from = location.state?.from?.pathname || '/';

  const { register, googleLogin, isAuthenticated } = useAuth();
  const [name, setName] = useState('');
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
    if (!name || !email || password.length < 6) {
      setError('Name, email, and a password of at least 6 characters are required.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      await register(name, email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="register-title">
        <h1 id="register-title">Create your account</h1>
        <p className="auth-subtitle">Save analyses to your private history and continue where you left off.</p>

        <form onSubmit={onSubmit} className="auth-form">
          <label htmlFor="name">Name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            placeholder="Your name"
            required
          />

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
            autoComplete="new-password"
            placeholder="At least 6 characters"
            minLength={6}
            required
          />

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="auth-btn" disabled={submitting}>
            {submitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <div className="auth-divider"><span>or</span></div>
        <div className="google-button-wrap" ref={googleButtonRef} />

        <p className="auth-footnote">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
