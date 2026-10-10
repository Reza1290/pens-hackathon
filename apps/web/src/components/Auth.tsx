import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Session, User } from '@kasirnusa/contracts';
import { api, ApiError } from '../lib/api';
import { getSessionToken, getSessionExpiry, setSessionToken } from '../lib/session';

type AuthState = { user: User | null; loading: boolean; error: string; retry: () => void; signIn: (session: Session) => void; signOut: () => Promise<void> };
const AuthContext = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(getSessionToken()));
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const token = getSessionToken();
    if (!token) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true); setError('');
    api.me(token, controller.signal).then(({ user }) => { if (!controller.signal.aborted) setUser(user); }).catch((cause: unknown) => {
      if (controller.signal.aborted) return;
      if (cause instanceof ApiError && cause.status === 401) { setSessionToken(null); setUser(null); }
      else setError('We couldn’t verify your session. Check your connection and try again.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => {
    const expired = () => { setSessionToken(null); setUser(null); setError(''); };
    window.addEventListener('session-expired', expired);
    return () => window.removeEventListener('session-expired', expired);
  }, []);
  useEffect(() => {
    if (!user || !getSessionExpiry()) return;
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      const remaining = Date.parse(getSessionExpiry()!) - Date.now();
      if (!Number.isFinite(remaining) || remaining <= 0) window.dispatchEvent(new Event('session-expired'));
      else timer = setTimeout(check, Math.min(remaining, 2_147_483_647));
    };
    check();
    return () => clearTimeout(timer);
  }, [user]);
  const signIn = (session: Session) => { setSessionToken(session.token, session.expires_at); setUser(session.user); setLoading(false); setError(''); };
  const signOut = async () => {
    const token = getSessionToken();
    if (token) {
      try { await api.logout(token); }
      catch (cause) { if (!(cause instanceof ApiError && cause.status === 401)) throw cause; }
    }
    setSessionToken(null); setUser(null); setError('');
  };
  return <AuthContext.Provider value={{ user, loading, error, retry: () => setAttempt((value) => value + 1), signIn, signOut }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('AuthProvider is required');
  return auth;
}
export function RequireSession({ children }: { children: ReactNode }) {
  const { user, loading, error, retry } = useAuth();
  const location = useLocation();
  if (loading) return <div className="session-message" role="status">Checking your session…</div>;
  if (error) return <div className="session-message"><p role="alert">{error}</p><button onClick={retry}>Try again</button></div>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return children;
}

export function safeDestination(value: string | null) {
  if (!value || !/^\/(opportunities|accounts|copilot|users|settings)(\/|\?|$)/.test(value) || /[\\\r\n]/.test(value)) return '/opportunities';
  return value;
}
