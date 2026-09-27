import { createHmac, pbkdf2Sync, timingSafeEqual } from 'node:crypto';

const COOKIE = 'cat_admin_session';
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const attempts = new Map();

const b64url = value => Buffer.from(value).toString('base64url');
const safeEqual = (a, b) => {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
};

function settings(env) {
  const username = String(env?.ADMIN_USERNAME || '').trim();
  const passwordHash = String(env?.ADMIN_PASSWORD_HASH || '').trim();
  const sessionSecret = String(env?.ADMIN_SESSION_SECRET || '').trim();
  if (!username || !passwordHash || sessionSecret.length < 32) throw new Error('admin auth not configured');
  return { username, passwordHash, sessionSecret };
}

function signature(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function verifyPassword(password, encoded) {
  const [iterationsText, salt, expected] = String(encoded).split('.');
  const iterations = Number(iterationsText);
  if (!Number.isInteger(iterations) || iterations < 100000 || !salt || !expected) return false;
  const actual = pbkdf2Sync(String(password), Buffer.from(salt, 'base64url'), iterations, 32, 'sha256').toString('base64url');
  return safeEqual(actual, expected);
}

function clientKey(request) {
  return String(request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown').split(',')[0].trim().slice(0, 100);
}

export function loginAllowed(request) {
  const key = clientKey(request), now = Date.now(), current = attempts.get(key);
  if (!current || now > current.resetAt) { attempts.set(key, { count: 0, resetAt: now + 15 * 60 * 1000 }); return true; }
  return current.count < 5;
}

export function recordLoginFailure(request) {
  const key = clientKey(request), now = Date.now(), current = attempts.get(key);
  attempts.set(key, !current || now > current.resetAt ? { count: 1, resetAt: now + 15 * 60 * 1000 } : { ...current, count: current.count + 1 });
}

export function clearLoginFailures(request) { attempts.delete(clientKey(request)); }

export function authenticateCredentials(env, username, password) {
  const configured = settings(env);
  return safeEqual(String(username), configured.username) && verifyPassword(password, configured.passwordHash);
}

export function createSessionCookie(env) {
  const { username, sessionSecret } = settings(env);
  const payload = b64url(JSON.stringify({ sub: username, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS }));
  const token = `${payload}.${signature(payload, sessionSecret)}`;
  return `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_SECONDS}`;
}

export function clearSessionCookie() { return `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`; }

export function requireAdmin(request, env) {
  const cookie = request.headers.get('cookie') || '';
  const token = cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!token) return null;
  const [payload, supplied] = token.split('.');
  if (!payload || !supplied) return null;
  const { username, sessionSecret } = settings(env);
  if (!safeEqual(supplied, signature(payload, sessionSecret))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.sub !== username || !Number.isFinite(data.exp) || data.exp <= Date.now() / 1000) return null;
    return { username };
  } catch { return null; }
}

export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const supplied = new URL(origin);
    const candidates = new Set([new URL(request.url).host]);
    // EdgeOne may expose its internal function URL in request.url while the
    // browser is visiting a custom domain. These forwarding headers retain
    // the original public host and are set by the platform, not page scripts.
    for (const name of ['x-forwarded-host', 'host']) {
      const value = request.headers.get(name)?.split(',')[0]?.trim();
      if (value) candidates.add(value);
    }
    if (!candidates.has(supplied.host)) return false;
    const forwardedProtocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
    return !forwardedProtocol || `${forwardedProtocol}:` === supplied.protocol;
  } catch { return false; }
}

export const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers },
});
