import { NextRequest, NextResponse } from 'next/server';
import { revokeSession } from '@/lib/server/auth';
import { clearSessionCookie } from '@/lib/server/cookies';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    await revokeSession(req);
  } catch {
    // Revoking is best-effort — the cookie is cleared either way, so the
    // client is logged out even if D1 is briefly unreachable.
  }
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response, new URL(req.url).protocol === 'https:');
  return response;
}
