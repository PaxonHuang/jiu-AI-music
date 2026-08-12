// Anonymous ("guest") sessions on D1.
//
// Transitional design, ahead of email sign-in:
//
//   * The app has always kept a device UUID in localStorage['jiu_user_id'].
//     That value becomes `users.id`, so a device's existing academy progress
//     and works line up with its server user with no migration step.
//   * `users.type` is already constrained to ('guest','email') by
//     migrations/0001_init.sql, so adding email sign-in later means flipping
//     `type` and setting `email` on the SAME row — the user keeps their
//     songs, fragments, and posts.
//
// Security note: the device id is client-supplied, so it is effectively a
// bearer token (a v4 UUID, i.e. unguessable). It is accepted only when
// minting a session; every later request authenticates with the signed,
// HttpOnly session cookie instead. Email sign-in replaces this.

import { nowIso, requireDb, type D1Database, type UserRow } from './db.ts';
import { getSessionExpiry, readSessionId } from './cookies.ts';

/** Device ids we mint are UUIDs; be strict about what we will key a user on. */
const DEVICE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{7,63}$/;

export function isValidDeviceId(value: unknown): value is string {
  return typeof value === 'string' && DEVICE_ID_PATTERN.test(value);
}

export interface SessionUser {
  id: string;
  type: UserRow['type'];
  displayName: string | null;
  email: string | null;
  /** ISO-8601 user creation time, used for "加入啾" display. */
  createdAt: string;
}

/**
 * Idempotent: calling twice with the same device id reuses the user row, so
 * repeat visits do not pile up duplicate guests.
 */
export async function createGuestSession(
  deviceId: string,
  db?: D1Database,
): Promise<{ sessionId: string; user: SessionUser }> {
  const database = db ?? (await requireDb());
  const now = nowIso();
  const sessionId = crypto.randomUUID();

  await database.batch([
    database
      .prepare(
        `insert into users (id, type, display_name, email, created_at, updated_at)
         values (?, 'guest', null, null, ?, ?)
         on conflict(id) do update set updated_at = excluded.updated_at`,
      )
      .bind(deviceId, now, now),
    database
      .prepare(
        `insert into sessions (id, user_id, expires_at, revoked_at, created_at)
         values (?, ?, ?, null, ?)`,
      )
      .bind(sessionId, deviceId, getSessionExpiry(), now),
  ]);

  const user = await findUser(database, deviceId);
  if (!user) throw new Error('Guest user vanished immediately after insert');
  return { sessionId, user };
}

/** Resolves the signed cookie to a user, or null when absent/expired/revoked. */
export async function getSessionUser(
  request: Request,
  db?: D1Database,
): Promise<SessionUser | null> {
  const sessionId = readSessionId(request);
  if (!sessionId) return null;

  const database = db ?? (await requireDb());
  const row = await database
    .prepare(
      `select u.id, u.type, u.display_name, u.email, u.created_at
         from sessions s
         join users u on u.id = s.user_id
        where s.id = ?
          and s.revoked_at is null
          and s.expires_at > ?`,
    )
    .bind(sessionId, nowIso())
    .first<Pick<UserRow, 'id' | 'type' | 'display_name' | 'email' | 'created_at'>>();

  return row ? toSessionUser(row) : null;
}

export async function revokeSession(request: Request, db?: D1Database): Promise<void> {
  const sessionId = readSessionId(request);
  if (!sessionId) return;
  const database = db ?? (await requireDb());
  await database
    .prepare(`update sessions set revoked_at = ? where id = ? and revoked_at is null`)
    .bind(nowIso(), sessionId)
    .run();
}

async function findUser(db: D1Database, id: string): Promise<SessionUser | null> {
  const row = await db
    .prepare(`select id, type, display_name, email, created_at from users where id = ?`)
    .bind(id)
    .first<Pick<UserRow, 'id' | 'type' | 'display_name' | 'email' | 'created_at'>>();
  return row ? toSessionUser(row) : null;
}

function toSessionUser(
  row: Pick<UserRow, 'id' | 'type' | 'display_name' | 'email' | 'created_at'>,
): SessionUser {
  return {
    id: row.id,
    type: row.type,
    displayName: row.display_name,
    email: row.email,
    createdAt: row.created_at,
  };
}
