import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server/auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    // 200 with user: null rather than 401 — "not signed in yet" is the normal
    // first-load state, not an error the client should treat as a failure.
    return NextResponse.json({ user });
  } catch (err) {
    return NextResponse.json(
      { error: 'internal', message: (err as Error).message },
      { status: 500 },
    );
  }
}
