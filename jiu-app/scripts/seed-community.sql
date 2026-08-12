-- 社区演示种子数据(幂等:重复执行不会产生重复行)
-- 用法: cd jiu-app && npx wrangler d1 execute jiu-music-db --remote --file scripts/seed-community.sql
-- 音频 taskId 全部来自 R2 桶 jiu-music-audio 里真实生成的 WAV,卡片点了能真播。
-- 注意:这是演示数据,不会写入任何密钥。

INSERT OR IGNORE INTO users (id, type, display_name, email, created_at, updated_at) VALUES
  ('seed-user-lark',    'guest', '小云雀', NULL, '2026-08-01T08:00:00.000Z', '2026-08-01T08:00:00.000Z'),
  ('seed-user-dolphin', 'guest', '小海豚', NULL, '2026-08-01T08:05:00.000Z', '2026-08-01T08:05:00.000Z'),
  ('seed-user-deer',    'guest', '小鹿',   NULL, '2026-08-02T08:00:00.000Z', '2026-08-02T08:00:00.000Z'),
  ('seed-user-panda',   'guest', '小熊猫', NULL, '2026-08-02T08:10:00.000Z', '2026-08-02T08:10:00.000Z'),
  ('seed-user-owl',     'guest', '小夜莺', NULL, '2026-08-03T08:00:00.000Z', '2026-08-03T08:00:00.000Z');

INSERT OR IGNORE INTO community_posts
  (id, user_id, body, moderation_status, status, like_count, favorite_count, comment_count, created_at, updated_at)
VALUES
  ('seed-post-0001', 'seed-user-lark',    '清晨的森林里，小鸟们合唱啦', 'approved', 'published', 3, 0, 0, '2026-08-07T10:00:00.000Z', '2026-08-07T10:00:00.000Z'),
  ('seed-post-0002', 'seed-user-dolphin', '海浪轻轻拍沙滩，好舒服呀',   'approved', 'published', 2, 0, 0, '2026-08-07T03:00:00.000Z', '2026-08-07T03:00:00.000Z'),
  ('seed-post-0003', 'seed-user-deer',    '我给我的小猫写了一首歌',     'approved', 'published', 5, 0, 0, '2026-08-06T21:00:00.000Z', '2026-08-06T21:00:00.000Z'),
  ('seed-post-0004', 'seed-user-panda',   '月光下的摇篮曲，安静温柔',   'approved', 'published', 1, 0, 0, '2026-08-06T12:00:00.000Z', '2026-08-06T12:00:00.000Z'),
  ('seed-post-0005', 'seed-user-lark',    '放学看到彩虹，做成了歌',     'approved', 'published', 4, 0, 0, '2026-08-05T09:00:00.000Z', '2026-08-05T09:00:00.000Z'),
  ('seed-post-0006', 'seed-user-owl',     '游乐园的一天，好开心',       'approved', 'published', 0, 0, 0, '2026-08-04T15:00:00.000Z', '2026-08-04T15:00:00.000Z'),
  ('seed-post-0007', 'seed-user-dolphin', '🌸 今天和妈妈去公园写生，发现池塘里的小鱼会自己挑颜色', 'approved', 'published', 2, 0, 0, '2026-08-08T07:30:00.000Z', '2026-08-08T07:30:00.000Z'),
  ('seed-post-0008', 'seed-user-deer',    '☕ 爸爸说这周学了一首很老的歌，等下次听我唱给你们听',   'approved', 'published', 1, 0, 0, '2026-08-09T18:20:00.000Z', '2026-08-09T18:20:00.000Z');

INSERT OR IGNORE INTO community_post_music (post_id, user_id, provider_task_id) VALUES
  ('seed-post-0001', 'seed-user-lark',    '202608436498118849069057'),
  ('seed-post-0002', 'seed-user-dolphin', '202608436414451577520130'),
  ('seed-post-0003', 'seed-user-deer',    '202608436307552655900673'),
  ('seed-post-0004', 'seed-user-panda',   '202608436307331192455169'),
  ('seed-post-0005', 'seed-user-lark',    '202608436283529014280193'),
  ('seed-post-0006', 'seed-user-owl',     '202608436256726319104001');
-- seed-post-0007 and seed-post-0008 are pure-text posts (no community_post_music row).

-- 点赞数要与 likes 表一致(toggleLike 会从表重算),这样热门排序和取消点赞都正确
INSERT OR IGNORE INTO community_post_likes (post_id, user_id, created_at) VALUES
  ('seed-post-0001', 'seed-user-dolphin', '2026-08-07T11:00:00.000Z'),
  ('seed-post-0001', 'seed-user-deer',    '2026-08-07T11:10:00.000Z'),
  ('seed-post-0001', 'seed-user-panda',   '2026-08-07T11:20:00.000Z'),
  ('seed-post-0002', 'seed-user-lark',    '2026-08-07T04:00:00.000Z'),
  ('seed-post-0002', 'seed-user-owl',     '2026-08-07T04:05:00.000Z'),
  ('seed-post-0003', 'seed-user-lark',    '2026-08-06T22:00:00.000Z'),
  ('seed-post-0003', 'seed-user-dolphin', '2026-08-06T22:05:00.000Z'),
  ('seed-post-0003', 'seed-user-panda',   '2026-08-06T22:10:00.000Z'),
  ('seed-post-0003', 'seed-user-owl',     '2026-08-06T22:15:00.000Z'),
  ('seed-post-0003', 'seed-user-deer',    '2026-08-06T22:20:00.000Z'),
  ('seed-post-0004', 'seed-user-lark',    '2026-08-06T13:00:00.000Z'),
  ('seed-post-0005', 'seed-user-dolphin', '2026-08-05T10:00:00.000Z'),
  ('seed-post-0005', 'seed-user-deer',    '2026-08-05T10:10:00.000Z'),
  ('seed-post-0005', 'seed-user-panda',   '2026-08-05T10:20:00.000Z'),
  ('seed-post-0005', 'seed-user-owl',     '2026-08-05T10:30:00.000Z'),
  ('seed-post-0007', 'seed-user-lark',    '2026-08-08T08:00:00.000Z'),
  ('seed-post-0007', 'seed-user-panda',   '2026-08-08T08:10:00.000Z'),
  ('seed-post-0008', 'seed-user-owl',     '2026-08-09T19:00:00.000Z');
