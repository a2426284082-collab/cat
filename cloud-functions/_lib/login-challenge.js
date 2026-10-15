import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const TTL_SECONDS = 90;
const consumed = new Map();
const equal = (a, b) => {
  const left = Buffer.from(String(a)), right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
};
const sign = (value, secret) => createHmac('sha256', secret).update(value).digest('base64url');
const cookieName = scope => scope === 'admin' ? 'cat_admin_challenge' : 'cat_assistant_challenge';

export function passwordParameters(encoded, allowTokenHash = false) {
  const parts = String(encoded).split('.');
  const [rounds, salt, hash] = parts;
  const iterations = Number(rounds);
  if (parts.length !== 3 || !/^[A-Za-z0-9_-]{1,128}$/.test(salt || '') ||
      !/^[A-Za-z0-9_-]{43}$/.test(hash || '') || Buffer.from(hash, 'base64url').length !== 32) return null;
  if (rounds === 'sha256' && allowTokenHash) return { algorithm: 'sha256-token', salt, iterations: 0, hash };
  if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 2000000) return null;
  return { algorithm: 'pbkdf2-sha256', salt, iterations, hash };
}

export function tokenHash(secret) {
  // Invite secrets are generated from 120 random bits, not human passwords.
  const salt = randomBytes(16);
  const hash = createHash('sha256').update(salt).update(String(secret)).digest('base64url');
  return `sha256.${salt.toString('base64url')}.${hash}`;
}

export function createLoginChallenge({ request, secret, scope, subject, encoded }) {
  const parameters = passwordParameters(encoded, scope === 'assistant');
  if (!parameters) throw Object.assign(new Error('invalid authentication hash'), { code: 'AUTH_HASH_INVALID' });
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    v: 1, scope, subject, origin: new URL(request.url).origin,
    nonce: randomBytes(24).toString('base64url'), iat: now, exp: now + TTL_SECONDS,
  })).toString('base64url');
  const challenge = `${payload}.${sign(`challenge:${payload}`, secret)}`;
  const { hash, ...publicParameters } = parameters;
  const nonce = JSON.parse(Buffer.from(payload, 'base64url').toString()).nonce;
  return {
    data: { ...publicParameters, challenge },
    cookie: `${cookieName(scope)}=${nonce}; HttpOnly; Secure; SameSite=Strict; Path=/api/${scope}; Max-Age=${TTL_SECONDS}`,
  };
}

export function verifyLoginProof({ request, secret, scope, subject, encoded, challenge, proof }) {
  if (typeof challenge !== 'string' || challenge.length > 2048 || !/^[A-Za-z0-9_-]{43}$/.test(proof || '')) return false;
  const parts = challenge.split('.');
  if (parts.length !== 2 || !equal(parts[1], sign(`challenge:${parts[0]}`, secret))) return false;
  let data;
  try { data = JSON.parse(Buffer.from(parts[0], 'base64url').toString()); } catch { return false; }
  const now = Math.floor(Date.now() / 1000);
  if (data.v !== 1 || data.scope !== scope || data.subject !== subject ||
      data.origin !== new URL(request.url).origin || !Number.isFinite(data.exp) ||
      data.exp <= now || data.exp > now + TTL_SECONDS || !Number.isFinite(data.iat) || data.iat > now ||
      typeof data.nonce !== 'string' || !/^[A-Za-z0-9_-]{32}$/.test(data.nonce)) return false;
  const browserNonce = (request.headers.get('cookie') || '').split(';').map(value => value.trim())
    .find(value => value.startsWith(`${cookieName(scope)}=`))?.slice(cookieName(scope).length + 1);
  if (!browserNonce || !equal(browserNonce, data.nonce)) return false;
  for (const [key, expiry] of consumed) if (expiry <= now) consumed.delete(key);
  const nonceKey = `${scope}:${data.nonce}`;
  if (consumed.has(nonceKey)) return false;
  const parameters = passwordParameters(encoded, scope === 'assistant');
  if (!parameters) return false;
  const expected = createHmac('sha256', Buffer.from(parameters.hash, 'base64url'))
    .update(`cat-login-v1:${challenge}`).digest('base64url');
  if (!equal(proof, expected)) return false;
  while (consumed.size >= 2048) consumed.delete(consumed.keys().next().value);
  consumed.set(nonceKey, data.exp);
  return true;
}
