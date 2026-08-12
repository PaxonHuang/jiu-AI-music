// D1 access layer. Replaces the `postgres` client used on the collaborator
// branch (Hyperdrive -> Neon); see migrations/0001_init.sql for the schema.
//
// The binding is resolved lazily through `getCloudflareContext()` so this
// module stays importable from unit tests running outside workerd. Callers
// that genuinely need a database should use `requireDb()`; callers that can
// degrade gracefully should use `getDb()` and handle `null`.
//
// D1 types are declared structurally (rather than pulling in
// @cloudflare/workers-types) to match the approach in lib/volcengine/r2.ts.

export interface D1Meta {
  duration?: number;
  rows_read?: number;
  rows_written?: number;
  last_row_id?: number;
  changes?: number;
}

export interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta: D1Meta;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<{ count: number; duration: number }>;
}

export function isD1Database(value: unknown): value is D1Database {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as D1Database).prepare === 'function' &&
    typeof (value as D1Database).batch === 'function'
  );
}

// Resolves the DB binding, or null when running outside a Worker (e.g. `next
// dev`, unit tests) or when the binding is not configured.
export async function getDb(): Promise<D1Database | null> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = getCloudflareContext();
    const db = (ctx?.env as { DB?: unknown } | undefined)?.DB;
    return isD1Database(db) ? db : null;
  } catch {
    return null;
  }
}

export async function requireDb(): Promise<D1Database> {
  const db = await getDb();
  if (!db) {
    throw new Error('D1 binding "DB" is unavailable — run via `wrangler dev` or deploy to Workers.');
  }
  return db;
}

// ---------------------------------------------------------------------------
// Storage conventions
//
// The schema stores timestamps as ISO-8601 text and booleans as 0/1 integers
// (SQLite has neither a timestamp nor a boolean type). These helpers keep the
// conversion in one place so query modules never hand-roll it.
// ---------------------------------------------------------------------------

export function nowIso(): string {
  return new Date().toISOString();
}

export function toSqlBool(value: boolean): number {
  return value ? 1 : 0;
}

export function fromSqlBool(value: number | boolean | null | undefined): boolean {
  return value === 1 || value === true;
}

// ---------------------------------------------------------------------------
// Row types — one per table in migrations/0001_init.sql.
// Shapes mirror SQLite storage, not the domain model: JSON columns are `string`
// and boolean columns are `number`. Mapping to domain objects belongs in the
// per-feature query modules.
// ---------------------------------------------------------------------------

export type UserType = 'guest' | 'email';
export type MusicTrack = 'vocal' | 'instrumental';
export type MusicTaskStatus = 'pending' | 'running' | 'success' | 'failed';
export type ModerationStatus = 'pending' | 'approved' | 'rejected';
export type PublishStatus = 'published' | 'deleted';
export type NotificationType =
  | 'post_like'
  | 'post_favorite'
  | 'comment'
  | 'comment_reply'
  | 'comment_like';

export interface UserRow {
  id: string;
  type: UserType;
  display_name: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionRow {
  id: string;
  user_id: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
}

export interface MusicTaskRow {
  id: string;
  user_id: string;
  provider_task_id: string;
  track: MusicTrack;
  /** JSON-encoded request payload; parse before use. */
  request_payload: string;
  status: MusicTaskStatus;
  progress: number;
  audio_url: string | null;
  lyrics: string | null;
  failure_code: number | null;
  failure_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommunityPostRow {
  id: string;
  user_id: string;
  body: string;
  moderation_status: ModerationStatus;
  status: PublishStatus;
  like_count: number;
  favorite_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
}

export interface CommunityPostMediaRow {
  id: string;
  post_id: string;
  url: string;
  content_type: string | null;
  sort_order: number;
}

export interface CommunityPostMusicRow {
  post_id: string;
  user_id: string;
  provider_task_id: string;
}

export interface CommunityPostLikeRow {
  post_id: string;
  user_id: string;
  created_at: string;
}

export type CommunityPostFavoriteRow = CommunityPostLikeRow;

export interface CommunityCommentRow {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  reply_to_user_id: string | null;
  body: string;
  like_count: number;
  created_at: string;
  updated_at: string;
  moderation_status: ModerationStatus;
  status: PublishStatus;
}

export interface CommunityCommentLikeRow {
  comment_id: string;
  user_id: string;
  created_at: string;
}

export interface CommunityNotificationRow {
  id: string;
  recipient_user_id: string;
  actor_user_id: string;
  type: NotificationType;
  post_id: string | null;
  comment_id: string | null;
  /** 0/1 — use `fromSqlBool` to read. */
  is_read: number;
  created_at: string;
}
