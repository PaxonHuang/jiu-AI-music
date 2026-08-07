// Signed session cookie.
//
// Ported from the collaborator branch's lib/server/cookies.ts. The cookie
// carries `<sessionId>.<hmac>` so a forged or tampered session id is rejected
// before it ever reaches D1; the id itself is still checked against the
// sessions table.

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextResponse } from 'next/server';

export const SESSION_COOKIE_NAME = 'jiu_session';

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const DEV_COOKIE_SECRET = 'jiu-local-development-cookie-secret';

export function getSessionExpiry(nowMs: number = Date.now()): string {
  return new Date(nowMs + SESSION_MAX_AGE_SECONDS * 1000).toISOString();
}

export function readSessionId(request: Request): string | null {
  const value = getCookieValue(request.headers.get('cookie'), SESSION_COOKIE_NAME);
  if (!value) return null;

  const [sessionId, signature, ...extra] = value.split('.');
  if (!sessionId || !signature || extra.length > 0) return null;

  const expected = signSessionId(sessionId);
  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;

  return sessionId;
}

export function setSessionCookie(response: NextResponse, sessionId: string, secure: boolean): void {
  response.cookies.set(SESSION_COOKIE_NAME, `${sessionId}.${signSessionId(sessionId)}`, {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax',
    secure,
  });
}

export function clearSessionCookie(response: NextResponse, secure: boolean): void {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
    sameSite: 'lax',
    secure,
  });
}

function signSessionId(sessionId: string): string {
  return createHmac('sha256', getCookieSecret()).update(sessionId).digest('base64url');
}

function getCookieSecret(): string {
  const secret = process.env.AUTH_COOKIE_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_COOKIE_SECRET must be set in production.');
  }
  return DEV_COOKIE_SECRET;
}

function getCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const cookie of cookieHeader.split(';')) {
    const [cookieName, ...valueParts] = cookie.trim().split('=');
    if (cookieName === name) return valueParts.join('=') || null;
  }
  return null;
}
