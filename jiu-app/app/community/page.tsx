'use client';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { GENRE_LABELS, INSTRUMENT_IDS, INSTRUMENT_LABELS, MOOD_LABELS } from '@/lib/constants';
import { getDeviceId, ensureSession } from '@/lib/client/session';
import { readWorkshopWorks } from '@/lib/workshop/storage';

interface Work {
  id: number;
  key: string;
  title: string;
  author: string;
  time: string;
  style: string;
  stars: number;
  starred: boolean;
  audio?: string;
  caption?: string;
  emoji?: string;
  instruments?: string[];
  /** Server post id — when set, starring calls the community API. */
  postId?: string;
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

const DEMO_WORKS: Work[] = [
  { id: 1, key: 'demo-1', title: '乡间小路', author: '小明', time: '2 分钟前', style: '😊 欢快', stars: 12, starred: false },
  { id: 2, key: 'demo-2', title: '山里的风', author: '小红', time: '1 小时前', style: '🌙 安静', stars: 8, starred: false },
  { id: 3, key: 'demo-3', title: '梦中的鸟', author: '小刚', time: '3 小时前', style: '✨ 梦幻', stars: 5, starred: false },
  { id: 4, key: 'demo-4', title: '溪水叮咚', author: '小美', time: '5 小时前', style: '🌙 安静', stars: 3, starred: false },
];

function postToWork(post: ServerPost): Work {
  return {
    id: 0,
    key: `post-${post.id}`,
    postId: post.id,
    title: post.body || '啾友的作品',
    author: post.authorName ?? '啾友',
    time: formatTime(post.createdAt),
    style: '🌍 大家创作',
    stars: post.likeCount,
    starred: post.liked,
    audio: post.audioUrl ?? undefined,
    caption: post.body || undefined,
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
  const [works, setWorks] = useState<Work[]>(DEMO_WORKS);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const user = ensureSession().catch(() => null);

    const localWorks: Work[] = readWorkshopWorks(getDeviceId())
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
        audio: work.audio,
        caption: work.caption,
        emoji: work.emoji,
        instruments: work.instruments,
      }));

    user.then((currentUser) => {
      if (cancelled) return;
      if (!currentUser) {
        // No session (server unreachable) — local works + demos only.
        setWorks([...localWorks, ...DEMO_WORKS]);
        return;
      }
      // Server reachable — community feed first, then my local works.
      fetch('/api/community/posts?limit=20')
        .then((response) => (response.ok ? response.json() as Promise<{ posts: ServerPost[] }> : null))
        .then((payload) => {
          if (cancelled) return;
          const serverWorks = (payload?.posts ?? []).map(postToWork);
          setWorks([...serverWorks, ...localWorks, ...DEMO_WORKS]);
        })
        .catch(() => {
          if (!cancelled) setWorks([...localWorks, ...DEMO_WORKS]);
        });
    });

    return () => {
      cancelled = true;
      audioRef.current?.pause();
    };
  }, []);

  const handleStar = async (work: Work) => {
    // Server post: toggle through the API, apply the returned state.
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

  const togglePlay = (work: Work) => {
    if (!work.audio) return;
    if (playingId === work.key && audioRef.current) {
      audioRef.current.pause();
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(work.audio);
    audioRef.current = audio;
    audio.onended = () => setPlayingId(null);
    void audio.play();
    setPlayingId(work.key);
  };

  return (
    <div className="min-h-screen bg-[#FFF8F0] pb-20">
      <div className="sticky top-0 z-10 bg-[#FFF8F0] px-4 py-3 border-b border-orange-100">
        <h1 className="text-xl font-bold text-gray-800 text-center">🌟 社区</h1>
      </div>

      <div className="p-4 space-y-3">
        {works.map((work) => (
          <motion.div
            key={work.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{work.emoji ?? '🎵'}</span>
              <div>
                <div className="font-semibold text-gray-800">{work.title}</div>
                <div className="text-xs text-gray-400">{work.author} · {work.time}</div>
              </div>
            </div>

            {work.caption && work.postId && (
              <p className="mb-3 rounded-xl bg-orange-50 px-3 py-2 text-sm text-gray-600">{work.caption}</p>
            )}

            <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center gap-3 mb-3">
              <button
                type="button"
                onClick={() => togglePlay(work)}
                disabled={!work.audio}
                aria-label={playingId === work.key ? `暂停${work.title}` : `播放${work.title}`}
                className="w-8 h-8 rounded-full bg-[#FF9F43] text-white flex items-center justify-center text-sm disabled:opacity-70"
              >
                {playingId === work.key ? 'Ⅱ' : '▶'}
              </button>
              <div className="flex-1 h-1.5 bg-gray-200 rounded-full">
                <div className={`h-full bg-[#FF9F43] rounded-full transition-all ${playingId === work.key ? 'w-2/3' : 'w-1/3'}`} />
              </div>
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
              <motion.button
                whileTap={{ scale: 1.3 }}
                onClick={() => void handleStar(work)}
                className={`flex items-center gap-1 text-sm transition-all ${
                  work.starred ? 'text-[#FF9F43]' : 'text-gray-400'
                }`}
              >
                <span className="text-lg">{work.starred ? '⭐' : '☆'}</span>
                <span>{work.stars}</span>
              </motion.button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
