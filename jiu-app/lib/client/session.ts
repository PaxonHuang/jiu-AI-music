// Client-side session bootstrap.
//
// The server keys guest users by the device UUID the app already keeps in
// localStorage['jiu_user_id'] (see stores/globalStore.ts getUserId). Calling
// ensureSession() exchanges that id for an HttpOnly session cookie so the
// community and workshop APIs can authenticate the user.

const USER_ID_KEY = 'jiu_user_id';

export interface SessionUser {
  id: string;
  type: 'guest' | 'email';
  displayName: string | null;
  email: string | null;
  createdAt: string;
}

let cached: SessionUser | null | undefined;

export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  let uid = localStorage.getItem(USER_ID_KEY);
  if (!uid) {
    uid = crypto.randomUUID();
    localStorage.setItem(USER_ID_KEY, uid);
  }
  return uid;
}

/**
 * Ensures a guest session exists and returns the current user, or null when
 * the server is unreachable (the app degrades to local-only mode then).
 * Result is cached for the page lifetime to avoid re-minting on every mount.
 */
export async function ensureSession(): Promise<SessionUser | null> {
  if (cached !== undefined) return cached;

  try {
    const response = await fetch('/api/auth/guest', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ deviceId: getDeviceId() }),
    });
    if (!response.ok) {
      cached = null;
      return cached;
    }
    const payload = (await response.json()) as { user?: SessionUser };
    cached = payload.user ?? null;
    return cached;
  } catch {
    cached = null;
    return cached;
  }
}

/** Test seam. */
export function resetSessionCache(): void {
  cached = undefined;
}
