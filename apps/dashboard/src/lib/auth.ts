/**
 * Minimal session token for the private dashboard.
 *
 * The token is a deterministic non-reversible digest of user+password+secret.
 * It is computed identically in the (edge) middleware and the (node) login
 * route, so we avoid async Web Crypto in middleware. This is adequate for a
 * single-operator private tool; for multi-user, swap in a real session store.
 */
export const SESSION_COOKIE = 'wma_session';

function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // mix a second pass for a longer token
  let h2 = 0x9e3779b1 ^ h;
  for (let i = str.length - 1; i >= 0; i--) {
    h2 ^= str.charCodeAt(i);
    h2 = Math.imul(h2, 0x85ebca77);
  }
  return (h >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

export function expectedToken(): string {
  const user = process.env.DASHBOARD_USER ?? 'admin';
  const pass = process.env.DASHBOARD_PASSWORD ?? 'admin';
  const secret = process.env.APP_SECRET ?? 'insecure-dev-secret';
  return fnv1a(`${user}:${pass}:${secret}`);
}

export function checkCredentials(user: string, pass: string): boolean {
  return user === (process.env.DASHBOARD_USER ?? 'admin') && pass === (process.env.DASHBOARD_PASSWORD ?? 'admin');
}
