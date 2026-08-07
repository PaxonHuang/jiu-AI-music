// Community queries.
//
// Minimal on purpose: list, publish, and like. The schema also has comments,
// favorites, and notifications tables; those routes come later.

import { nowIso, requireDb, type CommunityPostRow, type D1Database } from './db.ts';

export interface CommunityPost {
  id: string;
  authorId: string;
  authorName: string | null;
  body: string;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  /** Playable URL, when the post was published from a generated song. */
  audioUrl: string | null;
  taskId: string | null;
  /** Whether the requesting user has liked this post. */
  liked: boolean;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export function clampLimit(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

interface PostJoinRow {
  id: string;
  user_id: string;
  display_name: string | null;
  body: string;
  like_count: number;
  comment_count: number;
  created_at: string;
  provider_task_id: string | null;
  liked: number;
}

export async function listPosts(
  options: { limit: number; viewerId: string | null; db?: D1Database },
): Promise<CommunityPost[]> {
  const db = options.db ?? (await requireDb());

  // `liked` is resolved in the same statement so the list does not need an
  // N+1 follow-up per post.
  const { results } = await db
    .prepare(
      `select p.id, p.user_id, u.display_name, p.body, p.like_count, p.comment_count,
              p.created_at, m.provider_task_id,
              case when l.user_id is null then 0 else 1 end as liked
         from community_posts p
         join users u on u.id = p.user_id
         left join community_post_music m on m.post_id = p.id
         left join community_post_likes l on l.post_id = p.id and l.user_id = ?
        where p.status = 'published' and p.moderation_status = 'approved'
        order by p.created_at desc, p.id desc
        limit ?`,
    )
    .bind(options.viewerId ?? '', options.limit)
    .all<PostJoinRow>();

  return results.map(toCommunityPost);
}

export async function createPost(
  options: {
    userId: string;
    body: string;
    taskId?: string | null;
    audioUrl?: string | null;
    db?: D1Database;
  },
): Promise<CommunityPost> {
  const db = options.db ?? (await requireDb());
  const now = nowIso();
  const id = crypto.randomUUID();

  const statements = [
    db
      .prepare(
        // moderation_status is forced to 'approved' because there is no
        // moderation pipeline yet. When 敏感词过滤 lands this reverts to the
        // schema default ('pending') plus a review step.
        `insert into community_posts
           (id, user_id, body, moderation_status, status, like_count, favorite_count,
            comment_count, created_at, updated_at)
         values (?, ?, ?, 'approved', 'published', 0, 0, 0, ?, ?)`,
      )
      .bind(id, options.userId, options.body, now, now),
  ];

  if (options.taskId) {
    statements.push(
      db
        .prepare(
          `insert into community_post_music (post_id, user_id, provider_task_id)
           values (?, ?, ?)`,
        )
        .bind(id, options.userId, options.taskId),
    );
  }

  await db.batch(statements);

  return {
    id,
    authorId: options.userId,
    authorName: null,
    body: options.body,
    likeCount: 0,
    commentCount: 0,
    createdAt: now,
    audioUrl: options.taskId ? audioUrlForTask(options.taskId) : (options.audioUrl ?? null),
    taskId: options.taskId ?? null,
    liked: false,
  };
}

/**
 * Toggles a like. Returns the new state, or null when the post does not exist.
 * The counter is recomputed from the likes table rather than incremented, so a
 * double-tap (or a retried request) cannot drift it away from the truth.
 */
export async function toggleLike(
  options: { postId: string; userId: string; db?: D1Database },
): Promise<{ liked: boolean; likeCount: number } | null> {
  const db = options.db ?? (await requireDb());

  const post = await db
    .prepare(`select id from community_posts where id = ? and status = 'published'`)
    .bind(options.postId)
    .first<{ id: string }>();
  if (!post) return null;

  const existing = await db
    .prepare(`select user_id from community_post_likes where post_id = ? and user_id = ?`)
    .bind(options.postId, options.userId)
    .first<{ user_id: string }>();

  if (existing) {
    await db
      .prepare(`delete from community_post_likes where post_id = ? and user_id = ?`)
      .bind(options.postId, options.userId)
      .run();
  } else {
    await db
      .prepare(
        `insert into community_post_likes (post_id, user_id, created_at) values (?, ?, ?)`,
      )
      .bind(options.postId, options.userId, nowIso())
      .run();
  }

  const counted = await db
    .prepare(
      `update community_posts
          set like_count = (select count(*) from community_post_likes where post_id = ?)
        where id = ?
        returning like_count`,
    )
    .bind(options.postId, options.postId)
    .first<{ like_count: number }>();

  return { liked: !existing, likeCount: counted?.like_count ?? 0 };
}

export function audioUrlForTask(taskId: string): string {
  return `/api/music/audio/${encodeURIComponent(taskId)}`;
}

function toCommunityPost(row: PostJoinRow): CommunityPost {
  return {
    id: row.id,
    authorId: row.user_id,
    authorName: row.display_name,
    body: row.body,
    likeCount: row.like_count,
    commentCount: row.comment_count,
    createdAt: row.created_at,
    audioUrl: row.provider_task_id ? audioUrlForTask(row.provider_task_id) : null,
    taskId: row.provider_task_id,
    liked: row.liked === 1,
  };
}

export type { CommunityPostRow };
