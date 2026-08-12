'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { GENRE_LABELS, INSTRUMENT_IDS, INSTRUMENT_LABELS, MOOD_LABELS } from '@/lib/constants';
import { getDeviceId, ensureSession } from '@/lib/client/session';
import {
  getFavoriteCount,
  isFavoritedBy,
  toggleFavorite,
  useMockUser,
} from '@/lib/client/mock-social';
import { readWorkshopWorks } from '@/lib/workshop/storage';
import { PageHeader } from '@/components/layout/PageHeader';

interface Work {
  id: number;
  key: string;
  title: string;
  author: string;
  time: string;
  style: string;
  stars: number;
  starred: boolean;
  favorites: number;
  favorited: boolean;
  comments: number;
  audio?: string;
  caption?: string;
  emoji?: string;
  instruments?: string[];
  /** Server post id — when set, starring calls the community API. */
  postId?: string;
  /** Server post author — used to show a delete button on my own posts. */
  authorId?: string;
}

interface ServerPost {
  id: string;
  authorId: string;
  authorName: string | null;
  body: string;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  audioUrl: string | null;
  taskId: string | null;
  liked: boolean;
}

type Sort = 'latest' | 'hot';

const DEMO_WORKS: Work[] = [
  { id: 1, key: 'demo-1', title: '乡间小路', author: '小明', time: '2 分钟前', style: '😊 欢快', stars: 12, starred: false, favorites: 4, favorited: false, comments: 2 },
  { id: 2, key: 'demo-2', title: '山里的风', author: '小红', time: '1 小时前', style: '🌙 安静', stars: 8, starred: false, favorites: 1, favorited: false, comments: 0 },
  { id: 3, key: 'demo-3', title: '梦中的鸟', author: '小刚', time: '3 小时前', style: '✨ 梦幻', stars: 5, starred: false, favorites: 0, favorited: false, comments: 1 },
  { id: 4, key: 'demo-4', title: '溪水叮咚', author: '小美', time: '5 小时前', style: '🌙 安静', stars: 3, starred: false, favorites: 0, favorited: false, comments: 0 },
];

const PUBLISH_EMOJIS = ['🎵', '🐱', '🌈', '🌙', '🌊', '🌸', '⭐', '🎡'];

function postToWork(post: ServerPost, myUserId: string | null): Work {
  return {
    id: 0,
    key: `post-${post.id}`,
    postId: post.id,
    authorId: post.authorId,
    title: post.body || '啾友的作品',
    author: post.authorName ?? '啾友',
    time: formatTime(post.createdAt),
    style: '🌍 大家创作',
    stars: post.likeCount,
    starred: post.liked,
    favorites: post.id ? getFavoriteCount(post.id) : 0,
    favorited: post.id && myUserId ? isFavoritedBy(post.id, myUserId) : false,
    comments: post.commentCount,
    audio: post.audioUrl ?? undefined,
  };
}

function formatTime(iso: string): string {
  const elapsed = Date.now() - Date.parse(iso);
  if (Number.isNaN(elapsed) || elapsed < 0) return '刚刚';
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

export default function CommunityPage() {
  const mockUser = useMockUser();
  const [works, setWorks] = useState<Work[]>(DEMO_WORKS);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('latest');
  const [showPublish, setShowPublish] = useState(false);
  const [publishText, setPublishText] = useState('');
  const [publishEmoji, setPublishEmoji] = useState('🎵');
  const [publishing, setPublishing] = useState(false);

  const effectiveUserId = mockUser?.id ?? myUserId;

  const loadFeed = useCallback(
    async (sortValue: Sort) => {
      const current = await ensureSession().catch(() => null);
      setMyUserId(current?.id ?? null);

      const localWorks: Work[] = (await readWorkshopWorks(getDeviceId()))
        .filter((work) => work.status === 'published')
        .map((work) => ({
          id: work.id,
          key: `local-${work.id}`,
          title: work.title,
          author: '我',
          time: formatTime(work.createdAt),
          style: `${MOOD_LABELS[work.mood] ?? '原创'} · ${GENRE_LABELS[work.genre] ?? '音乐'}`,
          stars: 0,
          starred: false,
          favorites: 0,
          favorited: false,
          comments: 0,
          audio: work.audio,
          caption: work.caption,
          emoji: work.emoji,
          instruments: work.instruments,
        }));

      if (!current) {
        // No session (server unreachable) — local works + demos only.
        setWorks([...localWorks, ...DEMO_WORKS]);
        return;
      }
      try {
        const response = await fetch(`/api/community/posts?limit=20&sort=${sortValue}`);
        if (!response.ok) throw new Error(`feed ${response.status}`);
        const payload = (await response.json()) as { posts: ServerPost[] };
        const serverWorks = (payload.posts ?? []).map((post) => postToWork(post, current.id));
        // Real posts outrank the static demo cards; demos only show when the
        // feed is empty so a fresh demo never looks dead.
        setWorks(
          serverWorks.length > 0
            ? [...serverWorks, ...localWorks]
            : [...localWorks, ...DEMO_WORKS],
        );
      } catch {
        setWorks([...localWorks, ...DEMO_WORKS]);
      }
    },
    [],
  );

  useEffect(() => {
    void loadFeed(sort);
  }, [sort, loadFeed]);

  const submitPublish = async () => {
    const body = `${publishEmoji} ${publishText}`.trim();
    if (!body.replace(/^\S+\s/, '')) return;
    setPublishing(true);
    try {
      const response = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      if (response.ok) {
        setShowPublish(false);
        setPublishText('');
        await loadFeed(sort);
      }
    } catch {
      // Offline — keep the modal open so the text is not lost.
    } finally {
      setPublishing(false);
    }
  };

  const handleStar = async (work: Work) => {
    if (work.postId) {
      try {
        const response = await fetch(`/api/community/posts/${work.postId}/like`, { method: 'POST' });
        if (response.ok) {
          const result = (await response.json()) as { liked: boolean; likeCount: number };
          setWorks((prev) =>
            prev.map((w) =>
              w.key === work.key
                ? { ...w, starred: result.liked, stars: result.likeCount }
                : w,
            ),
          );
        }
      } catch {
        // Offline — keep the previous state.
      }
      return;
    }

    // Local work: optimistic toggle, exactly as before.
    setWorks((prev) =>
      prev.map((w) =>
        w.key === work.key
          ? { ...w, starred: !w.starred, stars: w.starred ? w.stars - 1 : w.stars + 1 }
          : w,
      ),
    );
  };

  const handleFavorite = (work: Work) => {
    if (!work.postId) {
      // Local work has no server post — favorites are mocked locally too.
      setWorks((prev) =>
        prev.map((w) =>
          w.key === work.key
            ? {
                ...w,
                favorited: !w.favorited,
                favorites: w.favorited ? Math.max(0, w.favorites - 1) : w.favorites + 1,
              }
            : w,
        ),
      );
      return;
    }
    if (!effectiveUserId) return;
    const result = toggleFavorite(work.postId, effectiveUserId, work.authorId ?? '');
    setWorks((prev) =>
      prev.map((w) =>
        w.key === work.key
          ? { ...w, favorited: result.favorited, favorites: result.count }
          : w,
      ),
    );
  };

  const handleDelete = async (work: Work) => {
    if (!work.postId) return;
    try {
      const response = await fetch(`/api/community/posts/${work.postId}`, { method: 'DELETE' });
      if (response.ok) {
        setWorks((prev) => prev.filter((w) => w.key !== work.key));
      }
    } catch {
      // Offline — keep the post.
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF8F0] pb-20">
      <PageHeader
        eyebrow="JIU COMMUNITY"
        title="啾啾社区"
        subtitle="分享你的音乐作品，听听大家的灵感"
      />

      {/* 最新 / 热门 */}
      <div className="jiu-tab-bar sticky top-[88px] z-10 flex gap-2 bg-[#FFF8F0]/95 px-4 py-2 backdrop-blur">
        {(
          [
            { key: 'latest', label: '🕐 最新' },
            { key: 'hot', label: '🔥 热门' },
          ] as { key: Sort; label: string }[]
        ).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setSort(item.key)}
            className={`rounded-xl px-4 py-1.5 text-sm font-bold transition-all ${
              sort === item.key
                ? 'bg-[#FF9F43] text-white shadow-md shadow-orange-200'
                : 'bg-white text-gray-500'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-3">
        {works.length === 0 ? (
          <div className="mt-14 text-center">
            <div className="text-5xl">🐣</div>
            <p className="mt-3 text-sm font-bold text-gray-500">
              还没有作品，去工坊创作第一首歌吧～
            </p>
            <Link
              href="/workshop"
              className="mt-4 inline-block rounded-xl bg-[#FF9F43] px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-orange-200"
            >
              去工坊
            </Link>
          </div>
        ) : (
          works.map((work) => (
            <motion.div
              key={work.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-orange-50 text-lg">
                  {work.emoji ?? (work.postId ? '🌍' : '🎵')}
                </span>
                <div className="min-w-0">
                  <div className="truncate font-semibold text-gray-800">{work.title}</div>
                  <div className="text-xs text-gray-400">{work.author} · {work.time}</div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl px-4 py-3 mb-3">
                {work.audio ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <audio
                    controls
                    preload="none"
                    src={work.audio}
                    className="w-full"
                  />
                ) : (
                  <p className="text-xs font-bold text-gray-400">音频不可播放</p>
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full">{work.style}</span>
                  {!work.postId && work.instruments && work.instruments.length > 0 && (
                    <span className="text-xs bg-[#F4EEFF] text-[#6D4AA1] px-2.5 py-1 rounded-full">
                      🎵 {work.instruments
                        .filter((id): id is keyof typeof INSTRUMENT_LABELS => (INSTRUMENT_IDS as readonly string[]).includes(id))
                        .map((id) => INSTRUMENT_LABELS[id])
                        .join('、')}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <motion.button
                    whileTap={{ scale: 1.3 }}
                    onClick={() => void handleStar(work)}
                    className={`flex items-center gap-1 text-sm transition-all ${
                      work.starred ? 'text-[#FF9F43]' : 'text-gray-400'
                    }`}
                    aria-label="点赞"
                  >
                    <span className="text-lg">{work.starred ? '⭐' : '☆'}</span>
                    <span>{work.stars}</span>
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 1.3 }}
                    onClick={() => handleFavorite(work)}
                    className={`flex items-center gap-1 text-sm transition-all ${
                      work.favorited ? 'text-[#E47A24]' : 'text-gray-400'
                    }`}
                    aria-label="收藏"
                  >
                    <span className="text-lg">{work.favorited ? '★' : '☆'}</span>
                    <span>{work.favorites}</span>
                  </motion.button>
                  {work.postId && (
                    <Link
                      href={`/community/${work.postId}`}
                      className="flex items-center gap-1 text-sm text-gray-400 transition-all hover:text-[#E47A24]"
                      aria-label="查看评论"
                    >
                      <span className="text-lg">💬</span>
                      <span>{work.comments}</span>
                    </Link>
                  )}
                  {work.postId && work.authorId === myUserId && (
                    <button
                      type="button"
                      onClick={() => void handleDelete(work)}
                      className="text-xs font-bold text-red-400"
                    >
                      删除
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* 悬浮发布按钮(底部居中,避开右下角的伴学小鸟) */}
      <button
        type="button"
        onClick={() => setShowPublish(true)}
        aria-label="发布新帖子"
        className="fixed bottom-20 left-1/2 z-30 grid h-14 w-14 -translate-x-1/2 place-items-center rounded-full bg-[#FF9F43] text-2xl text-white shadow-lg shadow-orange-300 active:scale-95"
      >
        +
      </button>

      <AnimatePresence>
        {showPublish && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
            onClick={() => setShowPublish(false)}
          >
            <motion.div
              initial={{ y: 60 }}
              animate={{ y: 0 }}
              exit={{ y: 60 }}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-lg rounded-t-3xl bg-white p-5 pb-8"
            >
              <div className="mb-3 text-center text-lg font-black text-gray-800">分享你的心情</div>
              <div className="mb-3 flex gap-2">
                {PUBLISH_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setPublishEmoji(emoji)}
                    className={`grid h-10 w-10 place-items-center rounded-xl text-xl transition-transform ${
                      publishEmoji === emoji ? 'scale-110 bg-orange-100 ring-2 ring-[#FF9F43]' : 'bg-gray-50'
                    }`}
                    aria-label={`选择表情${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <textarea
                value={publishText}
                onChange={(event) => setPublishText(event.target.value)}
                placeholder="写点想分享的话吧……"
                rows={3}
                maxLength={500}
                className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 outline-none focus:border-[#FF9F43]"
              />
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowPublish(false)}
                  className="flex-1 rounded-xl bg-gray-100 py-2.5 text-sm font-bold text-gray-500"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => void submitPublish()}
                  disabled={publishing || !publishText.trim()}
                  className="flex-1 rounded-xl bg-[#FF9F43] py-2.5 text-sm font-black text-white shadow-md shadow-orange-200 disabled:opacity-50"
                >
                  {publishing ? '发布中…' : '发布'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
