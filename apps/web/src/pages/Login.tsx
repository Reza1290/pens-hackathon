import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { safeDestination, useAuth } from '../components/Auth';
import './login.css';

export function Login() {
  const auth = useAuth();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const destination = safeDestination(params.get('next'));
  if (auth.user) return <Navigate to={destination} replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true; setPending(true); setError('');
    try { const session = await api.login({ email: email.trim(), password }); setPassword(''); auth.signIn(session); }
    catch (cause) { setError(cause instanceof ApiError && cause.status === 401 ? 'Email or password is incorrect. Please try again.' : 'We couldn’t sign you in. Please try again in a moment.'); }
    finally { submitting.current = false; setPending(false); }
  }

  return <div className="login-page">
    <a className="skip" href="#login-form">Skip to sign in</a>
    <aside className="login-story" aria-label="About the workbench">
      <Link className="login-brand" to="/" aria-label="KasirNusa home"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2L2 19.5h20L12 2zm0 4.2l6.5 11.3H5.5L12 6.2z" /></svg>KasirNusa</Link>
      <div className="login-story-content"><p className="login-eyebrow">ACCOUNT EXPANSION WORKBENCH</p><h2>A clearer picture.<br /><span>A better next step.</span></h2><p>Bring the request, the people and the evidence into your next customer conversation.</p>
        <div className="login-path" aria-label="Illustrative path from customer request through account context to proposed action">
          <div className="login-path-node"><span>01 / THE SIGNAL</span><strong>A customer asks to grow</strong><p>Connect the request to its source.</p></div>
          <div className="login-path-line"><span>CONNECTED CONTEXT</span></div>
          <div className="login-path-node"><span>02 / THE CONTEXT</span><strong>The right people. The current terms.</strong><p>Understand what the decision needs.</p></div>
          <div className="login-path-line"><span>INFORMED NEXT STEP</span></div>
          <div className="login-path-node accent"><span>03 / THE ACTION</span><strong>Prepare a specific follow-up</strong><p>Keep the evidence within reach.</p></div>
        </div>
      </div>
      <p className="login-story-footer">Evidence first. Human decisions.</p>
    </aside>
    <main className="login-main">
      <div className="login-top"><Link to="/">← Back to overview</Link><span>TEAM WORKSPACE</span></div>
      <div className="login-form-wrap">
        <p className="login-eyebrow"><span />WELCOME BACK</p><h1>Sign in to KasirNusa</h1><p className="login-description">Pick up where your last conversation left off.</p>
        {auth.loading ? <p role="status">Checking your session…</p> : auth.error ? <div className="login-error"><p role="alert">{auth.error}</p><button onClick={auth.retry}>Try again</button></div> : <form id="login-form" onSubmit={submit} aria-label="Sign in" aria-busy={pending}>
          <label htmlFor="login-email">Work email</label><input id="login-email" name="email" type="email" autoComplete="username" placeholder="you@kasirnusa.id" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={pending} />
          <label htmlFor="login-password">Password</label><div className="login-password"><input id="login-password" name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} maxLength={100} disabled={pending} /><button type="button" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} onClick={() => setVisible(!visible)} disabled={pending}>{visible ? 'Hide' : 'Show'}</button></div>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="login-submit" type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}<span aria-hidden="true">→</span></button>
          <p className="login-help">Need access or help with your password?<br />Contact your KasirNusa workspace administrator.</p>
        </form>}
      </div>
      <footer className="login-footer"><span>KasirNusa / Account Expansion Assistant</span><span>Internal workspace</span></footer>
    </main>
  </div>;
}
