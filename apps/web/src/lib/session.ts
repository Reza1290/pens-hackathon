const key = 'kasirnusa_session_token';
const expiryKey = 'kasirnusa_session_expiry';
let token: string | null = null;
let expiry: string | null = null;
try { token = sessionStorage.getItem(key); expiry = sessionStorage.getItem(expiryKey); } catch { /* In-memory sessions still work. */ }

export const getSessionToken = () => token;
export const getSessionExpiry = () => expiry;
export function setSessionToken(value: string | null, expiresAt?: string) {
  token = value; expiry = value ? expiresAt ?? null : null;
  try {
    if (value) sessionStorage.setItem(key, value); else sessionStorage.removeItem(key);
    if (expiry) sessionStorage.setItem(expiryKey, expiry); else sessionStorage.removeItem(expiryKey);
  } catch { /* Storage can be unavailable. */ }
}
