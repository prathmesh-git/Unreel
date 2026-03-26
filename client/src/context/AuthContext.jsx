import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiUrl } from '../lib/api';

const AuthContext = createContext(null);
const TOKEN_KEY = 'unreel_auth_token';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapUser() {
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(apiUrl('/api/auth/me'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (cancelled) return;
        if (!res.ok || !data.success) {
          setUser(null);
          setToken('');
          localStorage.removeItem(TOKEN_KEY);
          setLoading(false);
          return;
        }

        setUser(data.user);
      } catch {
        if (cancelled) return;
        setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    bootstrapUser();
    return () => {
      cancelled = true;
    };
  }, [token]);

  function storeSession(nextToken, nextUser) {
    setToken(nextToken);
    setUser(nextUser);
    localStorage.setItem(TOKEN_KEY, nextToken);
  }

  async function login(email, password) {
    const res = await fetch(apiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Login failed.');
    storeSession(data.token, data.user);
    return { user: data.user, isNewUser: Boolean(data.isNewUser) };
  }

  async function register(name, email, password) {
    const res = await fetch(apiUrl('/api/auth/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Registration failed.');
    storeSession(data.token, data.user);
    return { user: data.user, isNewUser: Boolean(data.isNewUser) };
  }

  async function googleLogin(credential) {
    const res = await fetch(apiUrl('/api/auth/google'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Google login failed.');
    storeSession(data.token, data.user);
    return { user: data.user, isNewUser: Boolean(data.isNewUser) };
  }

  async function updateEmailPreferences(emailAnalysisResults) {
    if (!token) throw new Error('You must be logged in.');

    const res = await fetch(apiUrl('/api/auth/preferences'), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ emailAnalysisResults }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Could not update preferences.');
    }

    setUser(data.user);
    return data.user;
  }

  function logout() {
    setToken('');
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
  }

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      isAuthenticated: Boolean(token && user),
      login,
      register,
      googleLogin,
      updateEmailPreferences,
      logout,
    }),
    [token, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
