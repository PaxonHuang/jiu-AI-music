import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

import { readSessionId, SESSION_COOKIE_NAME, getSessionExpiry } from './cookies.ts';
import { isValidDeviceId } from './auth.ts';
import { clampLimit } from './community.ts';

// Mirrors the dev fallback secret in cookies.ts. Tests run with NODE_ENV
// unset, so that is the key in play.
const DEV_SECRET = 'jiu-local-development-cookie-secret';

function sign(sessionId: string, secret = DEV_SECRET): string {
  return createHmac('sha256', secret).update(sessionId).digest('base64url');
}

function requestWithCookie(value: string): Request {
  return new Request('https://example.test/', {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${value}` },
  });
}

test('a correctly signed cookie resolves to its session id', () => {
  const id = 'b3f1c2d4-0000-4000-8000-000000000001';
  assert.equal(readSessionId(requestWithCookie(`${id}.${sign(id)}`)), id);
});

test('a tampered session id is rejected', () => {
  const id = 'b3f1c2d4-0000-4000-8000-000000000001';
  const signature = sign(id);
  assert.equal(readSessionId(requestWithCookie(`b3f1c2d4-0000-4000-8000-999999999999.${signature}`)), null);
});

test('a cookie signed with the wrong secret is rejected', () => {
  const id = 'b3f1c2d4-0000-4000-8000-000000000001';
  assert.equal(readSessionId(requestWithCookie(`${id}.${sign(id, 'attacker-secret')}`)), null);
});

test('an unsigned session id is rejected', () => {
  const id = 'b3f1c2d4-0000-4000-8000-000000000001';
  assert.equal(readSessionId(requestWithCookie(id)), null);
});

test('malformed cookies are rejected without throwing', () => {
  assert.equal(readSessionId(requestWithCookie('')), null);
  assert.equal(readSessionId(requestWithCookie('a.b.c')), null);
  assert.equal(readSessionId(new Request('https://example.test/')), null);
});

test('session expiry is a future ISO timestamp the schema stores as text', () => {
  const expiry = getSessionExpiry(Date.parse('2026-08-07T00:00:00.000Z'));
  assert.equal(expiry, '2026-09-06T00:00:00.000Z');
});

test('device ids must look like the UUIDs the app mints', () => {
  assert.equal(isValidDeviceId(crypto.randomUUID()), true);
  assert.equal(isValidDeviceId('short'), false);
  assert.equal(isValidDeviceId(''), false);
  assert.equal(isValidDeviceId(null), false);
  assert.equal(isValidDeviceId(42), false);
  // No path or SQL metacharacters.
  assert.equal(isValidDeviceId('../../etc/passwd'), false);
  assert.equal(isValidDeviceId("abcdefgh'; drop table users;--"), false);
});

test('list limit is clamped into range and falls back on junk', () => {
  assert.equal(clampLimit(null), 20);
  assert.equal(clampLimit('abc'), 20);
  assert.equal(clampLimit('0'), 20);
  assert.equal(clampLimit('-5'), 20);
  assert.equal(clampLimit('5'), 5);
  assert.equal(clampLimit('9999'), 50);
});
