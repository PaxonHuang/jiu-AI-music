-- 0001_init.sql — 社区 + 鉴权 + 工坊任务的初始 schema(11 张表)
--
-- 源自协作者分支 AutumnCs/JIU-AI-MUSIC 的 lib/server/schema.sql(Postgres 版),
-- 表结构与索引保持一致,仅做 SQLite/D1 类型修正:
--   * request_payload  jsonb   -> text     (SQLite 无 jsonb;jsonb 会落到 NUMERIC 亲和性,
--                                           JSON 字符串必须用 text 才不会被隐式转换)
--   * is_read          boolean -> integer  (SQLite 无 boolean 类型,0/1 存储)
-- 其余 text 主键 / text 时间戳 / integer 计数器本身即 SQLite 兼容,无需改动。

create table if not exists users (
  id text primary key,
  type text not null check (type in ('guest', 'email')),
  display_name text,
  email text,
  created_at text not null,
  updated_at text not null
);

create table if not exists sessions (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  expires_at text not null,
  revoked_at text,
  created_at text not null
);

create index if not exists idx_sessions_user_id on sessions(user_id);
create index if not exists idx_sessions_expires_at on sessions(expires_at);

create table if not exists music_tasks (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  provider_task_id text not null,
  track text not null check (track in ('vocal', 'instrumental')),
  request_payload text not null,
  status text not null check (status in ('pending', 'running', 'success', 'failed')),
  progress integer not null default 0,
  audio_url text,
  lyrics text,
  failure_code integer,
  failure_message text,
  created_at text not null,
  updated_at text not null,
  unique (provider_task_id, user_id)
);

create index if not exists idx_music_tasks_user_created on music_tasks(user_id, created_at desc);
create index if not exists idx_music_tasks_provider_user on music_tasks(provider_task_id, user_id);

create table if not exists community_posts (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  body text not null default '',
  moderation_status text not null default 'pending' check (moderation_status in ('pending', 'approved', 'rejected')),
  status text not null default 'published' check (status in ('published', 'deleted')),
  like_count integer not null default 0,
  favorite_count integer not null default 0,
  comment_count integer not null default 0,
  created_at text not null,
  updated_at text not null
);

create table if not exists community_post_media (
  id text primary key,
  post_id text not null references community_posts(id) on delete cascade,
  url text not null,
  content_type text,
  sort_order integer not null default 0
);

create table if not exists community_post_music (
  post_id text primary key references community_posts(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  provider_task_id text not null
);

create table if not exists community_post_likes (
  post_id text not null references community_posts(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  created_at text not null,
  primary key (post_id, user_id)
);

create table if not exists community_post_favorites (
  post_id text not null references community_posts(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  created_at text not null,
  primary key (post_id, user_id)
);

create table if not exists community_comments (
  id text primary key,
  post_id text not null references community_posts(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  parent_id text references community_comments(id) on delete cascade,
  reply_to_user_id text references users(id) on delete set null,
  body text not null,
  like_count integer not null default 0,
  created_at text not null,
  updated_at text not null,
  moderation_status text not null default 'pending' check (moderation_status in ('pending', 'approved', 'rejected')),
  status text not null default 'published' check (status in ('published', 'deleted'))
);

create table if not exists community_comment_likes (
  comment_id text not null references community_comments(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  created_at text not null,
  primary key (comment_id, user_id)
);

create table if not exists community_notifications (
  id text primary key,
  recipient_user_id text not null references users(id) on delete cascade,
  actor_user_id text not null references users(id) on delete cascade,
  type text not null check (type in ('post_like', 'post_favorite', 'comment', 'comment_reply', 'comment_like')),
  post_id text references community_posts(id) on delete cascade,
  comment_id text references community_comments(id) on delete cascade,
  is_read integer not null default 0,
  created_at text not null
);

create index if not exists idx_community_posts_latest on community_posts(status, moderation_status, created_at desc, id desc);
create index if not exists idx_community_posts_hot on community_posts(status, moderation_status, like_count desc, favorite_count desc, comment_count desc, created_at desc);
create index if not exists idx_community_post_media_post on community_post_media(post_id, sort_order);
create index if not exists idx_community_comments_post on community_comments(post_id, created_at asc);
create index if not exists idx_community_notifications_recipient on community_notifications(recipient_user_id, is_read, created_at desc);
