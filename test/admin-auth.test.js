import assert from 'node:assert/strict';
import { pbkdf2Sync } from 'node:crypto';
import test from 'node:test';
import { authenticateCredentials, createSessionCookie, requireAdmin, sameOrigin, verifyPassword } from '../cloud-functions/_lib/admin-auth.js';

const salt = Buffer.from('fixed-test-salt');
const iterations = 100000;
const password = 'correct horse battery staple';
const hash = pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('base64url');
const env = {
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD_HASH: `${iterations}.${salt.toString('base64url')}.${hash}`,
  ADMIN_SESSION_SECRET: 'a-test-session-secret-that-is-longer-than-32-characters',
};

test('admin password and signed session cookie authenticate safely', () => {
  assert.equal(verifyPassword(password, env.ADMIN_PASSWORD_HASH), true);
  assert.equal(verifyPassword('wrong', env.ADMIN_PASSWORD_HASH), false);
  assert.equal(authenticateCredentials(env, 'admin', password), true);
  assert.equal(authenticateCredentials(env, 'Admin', password), false);
  const cookie = createSessionCookie(env).split(';')[0];
  const request = new Request('https://cats.example/admin/', { headers: { cookie } });
  assert.deepEqual(requireAdmin(request, env), { username: 'admin' });
  const tampered = new Request('https://cats.example/admin/', { headers: { cookie: `${cookie}x` } });
  assert.equal(requireAdmin(tampered, env), null);
});

test('write requests require the exact same origin', () => {
  assert.equal(sameOrigin(new Request('https://cats.example/api/admin/login', { headers: { origin: 'https://cats.example' } })), true);
  assert.equal(sameOrigin(new Request('https://cats.example/api/admin/login', { headers: { origin: 'https://evil.example' } })), false);
});
