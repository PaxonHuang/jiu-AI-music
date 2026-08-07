import { NextRequest, NextResponse } from 'next/server';
import { createGuestSession, isValidDeviceId } from '@/lib/server/auth';
import { setSessionCookie } from '@/lib/server/cookies';

export const runtime = 'nodejs';

// Exchanges the device UUID the app already keeps in
// localStorage['jiu_user_id'] for a signed session cookie. Idempotent: the
// same device id always maps to the same guest user.
export async function POST(req: NextRequest) {
  let deviceId: unknown;
  try {
    const body = (await req.json()) as { deviceId?: unknown };
    deviceId = body.deviceId;
  } catch {
    return NextResponse.json(
      { error: 'bad_request', message: 'JSON body with deviceId required' },
      { status: 400 },
    );
  }

  if (!isValidDeviceId(deviceId)) {
    return NextResponse.json(
      { error: 'bad_request', message: 'deviceId must be 8-64 url-safe characters' },
      { status: 400 },
    );
  }

  try {
    const { sessionId, user } = await createGuestSession(deviceId);
    const response = NextResponse.json({ user });
    setSessionCookie(response, sessionId, new URL(req.url).protocol === 'https:');
    return response;
  } catch (err) {
    return NextResponse.json(
      { error: 'internal', message: (err as Error).message },
      { status: 500 },
    );
  }
}
