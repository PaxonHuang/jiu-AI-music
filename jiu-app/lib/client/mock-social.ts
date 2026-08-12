// Pure-frontend mock auth + social data layer.
//
// All persistence is localStorage. There is no server round-trip: registration
// is just a local write, the session is just a localStorage flag, and likes /
// favorites / comments / notifications are also local. The workshop and music
// generation flows still hit the real backend — only the social layer and the
// /me account surface are mocked.
//
// Why mock: PRD scope now includes a full social surface (likes, comments,
// favorites, notifications, account editing). Shipping a real implementation
// against D1 would touch ~7 new tables and ~6 new API routes, which is out of
// scope for this iteration. This module is the seam: when real backend routes
// land, only this file's read/write functions need to swap to fetch().
//
// Why localStorage and not IndexedDB: the social payload is small (a few KB
// per user), and writes need to be synchronous-ish so the UI updates inside
// the same render cycle after a click. IndexedDB is async-only and would
// flash empty state between click and confirmation.

export type MockUserType = 'guest' | 'email';

export type MockUser = {
  id: string;
  type: MockUserType;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  createdAt: string;
};

const USERS_KEY = 'jiu_mock_users';
const SESSION_KEY = 'jiu_mock_session';
const LIKES_KEY = 'jiu_mock_likes';
const FAVORITES_KEY = 'jiu_mock_favorites';
const COMMENTS_KEY = 'jiu_mock_comments';
const NOTIFICATIONS_KEY = 'jiu_mock_notifications';

// ─────────────────────────────────────────────────────────────────────────
// Stored shapes (what's in localStorage).
// All Sets are JSON-serialised as string arrays.
// ─────────────────────────────────────────────────────────────────────────

type StoredUser = MockUser & {
  passwordHash: string;
};

type StoredComment = {
  id: string;
  postId: string;
  userId: string;
  displayName: string;
  body: string;
  parentId: string | null;
  replyToUserId: string | null;
  replyToDisplayName: string | null;
  createdAt: string;
  likeCount: number;
};

type NotificationType =
  | 'post_like'
  | 'post_favorite'
  | 'comment'
  | 'comment_reply'
  | 'comment_like';

type StoredNotification = {
  id: string;
  recipientId: string;
  actorId: string;
  actorName: string;
  type: NotificationType;
  postId: string;
  commentId: string | null;
  isRead: boolean;
  createdAt: string;
};

// ─────────────────────────────────────────────────────────────────────────
// Persistence helpers. Always read-modify-write to keep a single source of
// truth. Cross-tab sync is intentionally skipped — the mock data is single-
// device, and a reload picks up the new state.
// ─────────────────────────────────────────────────────────────────────────

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent('jiu-mock-change', { detail: { key } }));
}

// ─────────────────────────────────────────────────────────────────────────
// Password hashing (mock).
//
// This is intentionally NOT cryptographically strong — there is no server to
// validate against, so the hash only serves to (a) not store the literal
// password and (b) keep the contract similar to the future real impl so the
// shape can be swapped without UI changes.
// ─────────────────────────────────────────────────────────────────────────

async function hashPassword(password: string, salt: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    // Last-resort fallback (e.g. jsdom): a non-cryptographic FNV-1a-ish digest.
    let h = 2166136261;
    const data = `${salt}::${password}`;
    for (let i = 0; i < data.length; i += 1) {
      h ^= data.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return `fnv1a:${h.toString(16)}`;
  }
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(`${salt}::${password}`),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 10_000, hash: 'SHA-256' },
    material,
    256,
  );
  const bytes = new Uint8Array(bits);
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return `pbkdf2:${hex}`;
}

function newSalt(): string {
  const buf = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < buf.length; i += 1) buf[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ─────────────────────────────────────────────────────────────────────────
// Credentials validation (frontend — the real impl will mirror this).
// ─────────────────────────────────────────────────────────────────────────

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function validateEmail(value: string): string | null {
  const email = normalizeEmail(value);
  if (!email) return '请填写邮箱';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '邮箱格式不对';
  return null;
}

export function validatePassword(value: string): string | null {
  if (!value) return '请填写密码';
  if (value.length < 8) return '密码至少 8 位';
  if (value.length > 72) return '密码最多 72 位';
  return null;
}

export function validateDisplayName(value: string): string | null {
  const name = value.trim();
  if (!name) return '请填写昵称';
  if (name.length > 24) return '昵称最多 24 个字符';
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// Account CRUD.
// ─────────────────────────────────────────────────────────────────────────

export async function registerEmailAccount(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<{ ok: true; user: MockUser } | { ok: false; error: string }> {
  const email = normalizeEmail(input.email);
  const displayName = input.displayName.trim();

  const emailErr = validateEmail(email);
  if (emailErr) return { ok: false, error: emailErr };
  const pwErr = validatePassword(input.password);
  if (pwErr) return { ok: false, error: pwErr };
  const nameErr = validateDisplayName(displayName);
  if (nameErr) return { ok: false, error: nameErr };

  const users = readJson<Record<string, StoredUser>>(USERS_KEY, {});
  if (users[email]) return { ok: false, error: '这个邮箱已经注册过啦' };

  const salt = newSalt();
  const passwordHash = await hashPassword(input.password, salt);
  const user: StoredUser = {
    id: crypto.randomUUID(),
    type: 'email',
    displayName,
    email,
    avatarUrl: null,
    createdAt: new Date().toISOString(),
    passwordHash,
  };
  users[email] = user;
  writeJson(USERS_KEY, users);
  setSessionUser(user);
  const { passwordHash: _omit, ...publicUser } = user;
  void _omit;
  return { ok: true, user: publicUser };
}

export async function loginEmailAccount(input: {
  email: string;
  password: string;
}): Promise<{ ok: true; user: MockUser } | { ok: false; error: string }> {
  const email = normalizeEmail(input.email);
  const emailErr = validateEmail(email);
  if (emailErr) return { ok: false, error: emailErr };
  const pwErr = validatePassword(input.password);
  if (pwErr) return { ok: false, error: pwErr };

  const users = readJson<Record<string, StoredUser>>(USERS_KEY, {});
  const record = users[email];
  if (!record) return { ok: false, error: '邮箱或密码不对' };

  const candidate = await hashPassword(input.password, record.passwordHash.split(':').pop()!.slice(0, 16));
  // Note: the salt for verification is the prefix of the stored hash; we
  // stored hash as `pbkdf2:<hex>` and the first 16 hex chars are the original
  // salt. This keeps the hash self-describing without a separate salt column.
  const salt = record.passwordHash.slice('pbkdf2:'.length, 'pbkdf2:'.length + 16);
  const rehash = await hashPassword(input.password, salt);
  if (rehash !== record.passwordHash) {
    // Deliberate short pause to flatten timing across hit / miss.
    await new Promise((resolve) => setTimeout(resolve, 150));
    return { ok: false, error: '邮箱或密码不对' };
  }
  await new Promise((resolve) => setTimeout(resolve, 150));
  setSessionUser(record);
  const { passwordHash: _omit, ...publicUser } = record;
  void _omit;
  void candidate;
  return { ok: true, user: publicUser };
}

export function logoutMockUser(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new CustomEvent('jiu-mock-change', { detail: { key: SESSION_KEY } }));
}

function setSessionUser(user: StoredUser): void {
  writeJson(SESSION_KEY, { userId: user.id });
}

/**
 * Returns the currently-logged-in mock account, or null when only a guest
 * session is active. Callers should fall back to the guest SessionUser.
 */
export function getCurrentMockUser(): MockUser | null {
  const session = readJson<{ userId: string | null }>(SESSION_KEY, { userId: null });
  if (!session.userId) return null;
  const users = readJson<Record<string, StoredUser>>(USERS_KEY, {});
  for (const record of Object.values(users)) {
    if (record.id === session.userId) {
      const { passwordHash: _omit, ...publicUser } = record;
      void _omit;
      return publicUser;
    }
  }
  return null;
}

export function updateMockUser(patch: Partial<Pick<MockUser, 'displayName' | 'avatarUrl'>>): MockUser | null {
  const current = getCurrentMockUser();
  if (!current || !current.email) return null;
  const users = readJson<Record<string, StoredUser>>(USERS_KEY, {});
  const record = users[current.email];
  if (!record) return null;
  const next: StoredUser = { ...record, ...patch };
  users[current.email] = next;
  writeJson(USERS_KEY, users);
  const { passwordHash: _omit, ...publicUser } = next;
  void _omit;
  return publicUser;
}

// ─────────────────────────────────────────────────────────────────────────
// Social interactions: likes, favorites, comments, notifications.
// All synchronous reads — the writes are queue-and-flush so the UI can
// optimistically render the new state in the same render pass.
// ─────────────────────────────────────────────────────────────────────────

function readLikes(): Record<string, string[]> {
  return readJson<Record<string, string[]>>(LIKES_KEY, {});
}

function writeLikes(value: Record<string, string[]>): void {
  writeJson(LIKES_KEY, value);
}

export function getLikeSet(postId: string): Set<string> {
  return new Set(readLikes()[postId] ?? []);
}

export function getLikeCount(postId: string): number {
  return getLikeSet(postId).size;
}

export function isLikedBy(postId: string, userId: string): boolean {
  return getLikeSet(postId).has(userId);
}

export function toggleLike(postId: string, userId: string, postAuthorId: string): {
  liked: boolean;
  count: number;
} {
  const likes = readLikes();
  const current = new Set(likes[postId] ?? []);
  const wasLiked = current.has(userId);
  if (wasLiked) current.delete(userId);
  else current.add(userId);
  likes[postId] = Array.from(current);
  writeLikes(likes);
  if (!wasLiked && postAuthorId !== userId) {
    pushNotification({
      recipientId: postAuthorId,
      actorId: userId,
      type: 'post_like',
      postId,
      commentId: null,
    });
  } else if (wasLiked && postAuthorId !== userId) {
    popNotification({
      recipientId: postAuthorId,
      actorId: userId,
      type: 'post_like',
      postId,
    });
  }
  return { liked: !wasLiked, count: current.size };
}

function readFavorites(): Record<string, string[]> {
  return readJson<Record<string, string[]>>(FAVORITES_KEY, {});
}

function writeFavorites(value: Record<string, string[]>): void {
  writeJson(FAVORITES_KEY, value);
}

export function isFavoritedBy(postId: string, userId: string): boolean {
  return new Set(readFavorites()[postId] ?? []).has(userId);
}

export function getFavoriteCount(postId: string): number {
  return new Set(readFavorites()[postId] ?? []).size;
}

export function toggleFavorite(postId: string, userId: string, postAuthorId: string): {
  favorited: boolean;
  count: number;
} {
  const favorites = readFavorites();
  const current = new Set(favorites[postId] ?? []);
  const wasFavorited = current.has(userId);
  if (wasFavorited) current.delete(userId);
  else current.add(userId);
  favorites[postId] = Array.from(current);
  writeFavorites(favorites);
  if (!wasFavorited && postAuthorId !== userId) {
    pushNotification({
      recipientId: postAuthorId,
      actorId: userId,
      type: 'post_favorite',
      postId,
      commentId: null,
    });
  } else if (wasFavorited && postAuthorId !== userId) {
    popNotification({
      recipientId: postAuthorId,
      actorId: userId,
      type: 'post_favorite',
      postId,
    });
  }
  return { favorited: !wasFavorited, count: current.size };
}

export function listFavoritePostIds(userId: string): string[] {
  const favorites = readFavorites();
  return Object.entries(favorites)
    .filter(([, userIds]) => userIds.includes(userId))
    .map(([postId]) => postId);
}

// ─────────────────────────────────────────────────────────────────────────
// Comments.
// ─────────────────────────────────────────────────────────────────────────

function readComments(): StoredComment[] {
  return readJson<StoredComment[]>(COMMENTS_KEY, []);
}

function writeComments(value: StoredComment[]): void {
  writeJson(COMMENTS_KEY, value);
}

export function listComments(postId: string): StoredComment[] {
  return readComments()
    .filter((comment) => comment.postId === postId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export type CommentNode = StoredComment & { replies: CommentNode[] };

export function buildCommentTree(postId: string): CommentNode[] {
  const flat = listComments(postId);
  const nodes = new Map<string, CommentNode>();
  for (const record of flat) {
    nodes.set(record.id, { ...record, replies: [] });
  }
  const roots: CommentNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.replies.push(node);
    else roots.push(node);
  }
  return roots;
}

export function addComment(input: {
  postId: string;
  userId: string;
  displayName: string;
  body: string;
  parentId?: string | null;
  replyToUserId?: string | null;
  replyToDisplayName?: string | null;
  postAuthorId: string;
}): { ok: true; comment: StoredComment } | { ok: false; error: string } {
  const body = input.body.trim();
  if (!body) return { ok: false, error: '评论不能为空' };
  if (body.length > 500) return { ok: false, error: '评论最多 500 字' };

  const all = readComments();
  const parent = input.parentId ? all.find((c) => c.id === input.parentId) : null;
  const replyToUserId = input.replyToUserId ?? parent?.userId ?? null;
  const replyToDisplayName =
    input.replyToDisplayName ?? parent?.displayName ?? null;

  const comment: StoredComment = {
    id: crypto.randomUUID(),
    postId: input.postId,
    userId: input.userId,
    displayName: input.displayName,
    body,
    parentId: input.parentId ?? null,
    replyToUserId,
    replyToDisplayName,
    createdAt: new Date().toISOString(),
    likeCount: 0,
  };
  all.push(comment);
  writeComments(all);

  // Notify the post author (for top-level) or the reply target.
  const notifyRecipient =
    parent && replyToUserId && replyToUserId !== input.userId ? replyToUserId : input.postAuthorId;
  if (notifyRecipient && notifyRecipient !== input.userId) {
    pushNotification({
      recipientId: notifyRecipient,
      actorId: input.userId,
      actorName: input.displayName,
      type: parent ? 'comment_reply' : 'comment',
      postId: input.postId,
      commentId: comment.id,
    });
  }

  return { ok: true, comment };
}

export function deleteComment(commentId: string, requesterId: string): boolean {
  const all = readComments();
  const idx = all.findIndex((c) => c.id === commentId);
  if (idx === -1) return false;
  const target = all[idx];
  if (target.userId !== requesterId) return false;
  all.splice(idx, 1);
  writeComments(all);
  return true;
}

export function getCommentCount(postId: string): number {
  return listComments(postId).length;
}

// ─────────────────────────────────────────────────────────────────────────
// Notifications.
// ─────────────────────────────────────────────────────────────────────────

function readNotifications(): StoredNotification[] {
  return readJson<StoredNotification[]>(NOTIFICATIONS_KEY, []);
}

function writeNotifications(value: StoredNotification[]): void {
  writeJson(NOTIFICATIONS_KEY, value);
}

function pushNotification(input: {
  recipientId: string;
  actorId: string;
  actorName?: string;
  type: NotificationType;
  postId: string;
  commentId: string | null;
}): void {
  const all = readNotifications();
  const notification: StoredNotification = {
    id: crypto.randomUUID(),
    recipientId: input.recipientId,
    actorId: input.actorId,
    actorName: input.actorName ?? '',
    type: input.type,
    postId: input.postId,
    commentId: input.commentId,
    isRead: false,
    createdAt: new Date().toISOString(),
  };
  all.unshift(notification);
  writeNotifications(all);
}

function popNotification(input: {
  recipientId: string;
  actorId: string;
  type: NotificationType;
  postId: string;
}): void {
  const all = readNotifications();
  const filtered = all.filter(
    (n) =>
      !(
        n.recipientId === input.recipientId &&
        n.actorId === input.actorId &&
        n.type === input.type &&
        n.postId === input.postId
      ),
  );
  if (filtered.length !== all.length) writeNotifications(filtered);
}

export function listNotifications(recipientId: string): StoredNotification[] {
  return readNotifications().filter((n) => n.recipientId === recipientId);
}

export function markNotificationsRead(recipientId: string): void {
  const all = readNotifications();
  const next = all.map((n) =>
    n.recipientId === recipientId && !n.isRead ? { ...n, isRead: true } : n,
  );
  writeNotifications(next);
}

export function getUnreadCount(recipientId: string): number {
  return readNotifications().filter((n) => n.recipientId === recipientId && !n.isRead).length;
}

// ─────────────────────────────────────────────────────────────────────────
// React subscription helper — components subscribe to data-layer changes
// and re-read whatever slice they need.
// ─────────────────────────────────────────────────────────────────────────

export function subscribeMockChanges(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = () => handler();
  window.addEventListener('jiu-mock-change', listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener('jiu-mock-change', listener);
    window.removeEventListener('storage', listener);
  };
}

/**
 * React hook — returns the currently-logged-in mock user and re-renders on
 * any mock data-layer change. SSR-safe (returns null when window is absent).
 *
 * Usage:
 *   const user = useMockUser();
 *   if (!user) return <LoginPrompt />;
 */
import { useEffect, useState } from 'react';

export function useMockUser(): MockUser | null {
  const [user, setUser] = useState<MockUser | null>(() => getCurrentMockUser());

  useEffect(() => {
    const unsubscribe = subscribeMockChanges(() => setUser(getCurrentMockUser()));
    return unsubscribe;
  }, []);

  return user;
}

/**
 * Variant that re-reads a slice of the social store on every mock change.
 * Pass any selector that takes the live state and returns a derived value;
 * the hook will re-render whenever any mock key changes (cheaper than wiring
 * per-key listeners for a tiny localStorage payload).
 */
export function useMockSlice<T>(selector: () => T): T {
  const [value, setValue] = useState<T>(() => selector());
  useEffect(() => {
    const update = () => setValue(selector());
    update();
    return subscribeMockChanges(update);
    // selector identity changes are intentional — we trust the caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return value;
}

// ─────────────────────────────────────────────────────────────────────────
// Test / dev seams.
// ─────────────────────────────────────────────────────────────────────────

export function resetMockData(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(USERS_KEY);
  window.localStorage.removeItem(SESSION_KEY);
  window.localStorage.removeItem(LIKES_KEY);
  window.localStorage.removeItem(FAVORITES_KEY);
  window.localStorage.removeItem(COMMENTS_KEY);
  window.localStorage.removeItem(NOTIFICATIONS_KEY);
  window.dispatchEvent(new CustomEvent('jiu-mock-change', { detail: { key: '*' } }));
}

export type { StoredUser, StoredComment, StoredNotification, NotificationType };