'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { GENRE_LABELS, MOOD_LABELS } from '@/lib/constants';
import { ensureSession } from '@/lib/client/session';
import { readWorkshopWorks, deleteWorkshopWork } from '@/lib/workshop/storage';
import type { PublishedWork } from '@/lib/workshop/works';

type Tab = 'works' | 'posts';

interface MyPost {
  id: string;
  body: string;
  createdAt: string;
  likeCount: number;
}

function formatJoinDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}年${date.getMonth() + 1}月加入啾`;
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

export default function MePage() {
  const [tab, setTab] = useState<Tab>('works');
  const [nickname, setNickname] = useState('啾友');
  const [joinDate, setJoinDate] = useState('');
  const [works, setWorks] = useState<PublishedWork[]>([]);
  const [posts, setPosts] = useState<MyPost[]>([]);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fetchMyPosts = async () => {
    try {
      const response = await fetch('/api/community/posts?mine=1&limit=50');
      if (!response.ok) return;
      const payload = (await response.json()) as { posts: MyPost[] };
      setPosts(payload.posts);
    } catch {
      // Server down — leave posts empty.
    }
  };

  useEffect(() => {
    const user = ensureSession().catch(() => null);
    user.then((current) => {
      if (current) {
        setNickname(current.displayName ?? '啾友');
        setJoinDate(formatJoinDate(current.createdAt));
        void fetchMyPosts();
      }
    });
    void readWorkshopWorks(
      typeof window !== 'undefined' ? localStorage.getItem('jiu_user_id') : null,
    ).then(setWorks);
  }, []);

  const removeWork = async (id: number) => {
    await deleteWorkshopWork(
      typeof window !== 'undefined' ? localStorage.getItem('jiu_user_id') : null,
      id,
    );
    setWorks((prev) => prev.filter((work) => work.id !== id));
  };

  const removePost = async (id: string) => {
    try {
      const response = await fetch(`/api/community/posts/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setPosts((prev) => prev.filter((post) => post.id !== id));
      }
    } catch {
      // Offline — keep the post.
    }
  };

  const togglePlay = (work: { id: number; audio: string }) => {
    if (playingId === work.id && audioRef.current) {
      audioRef.current.pause();
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(work.audio);
    audioRef.current = audio;
    audio.onended = () => setPlayingId(null);
    void audio.play();
    setPlayingId(work.id);
  };

  return (
    <div className="min-h-screen bg-[#FFF8F0] pb-20">
      <div className="sticky top-0 z-10 bg-[#FFF8F0] px-4 py-3 border-b border-orange-100">
        <h1 className="text-xl font-bold text-gray-800 text-center">👤 我</h1>
      </div>

      {/* 个人信息卡（只读） */}
      <div className="mx-4 mt-4 flex items-center gap-4 rounded-2xl bg-gradient-to-br from-orange-50 to-white p-4 shadow-sm border border-orange-100">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white text-4xl shadow-sm">
          🐦
        </div>
        <div className="min-w-0">
          <p className="text-lg font-black text-gray-800">{nickname}</p>
          <p className="mt-0.5 text-xs text-gray-400">
            {joinDate || '啾世界的小游客'}
          </p>
        </div>
      </div>

      {/* 标签导航 */}
      <div className="mx-4 mt-4 flex gap-2">
        {(
          [
            { key: 'works', label: '🎵 我的作品' },
            { key: 'posts', label: '📮 我的帖子' },
          ] as { key: Tab; label: string }[]
        ).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all ${
              tab === item.key
                ? 'bg-[#FF9F43] text-white shadow-lg shadow-orange-200'
                : 'bg-white text-gray-500'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {tab === 'works' && (
          <div>
            {works.length === 0 ? (
              <div className="mt-10 text-center">
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
              <div className="grid grid-cols-2 gap-3">
                {works.map((work) => (
                  <motion.div
                    key={work.id}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="overflow-hidden rounded-2xl bg-white shadow-sm border border-gray-50"
                  >
                    <div className="relative flex h-20 items-center justify-center bg-gradient-to-br from-orange-100 to-yellow-50">
                      <button
                        type="button"
                        onClick={() => togglePlay(work)}
                        aria-label={`播放${work.title}`}
                        className="grid h-11 w-11 place-items-center rounded-full bg-[#FF9F43] text-white shadow-md"
                      >
                        {playingId === work.id ? 'Ⅱ' : '▶'}
                      </button>
                      {work.status === 'published' && (
                        <span className="absolute right-1.5 top-1.5 rounded-full bg-green-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                          已发布
                        </span>
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="truncate text-sm font-bold text-gray-800">{work.title}</p>
                      <p className="mt-0.5 truncate text-[10px] text-gray-400">
                        {MOOD_LABELS[work.mood] ?? ''} · {GENRE_LABELS[work.genre] ?? ''}
                      </p>
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="text-[10px] text-gray-400">{formatTime(work.createdAt)}</span>
                        <button
                          type="button"
                          onClick={() => void removeWork(work.id)}
                          className="text-[10px] font-bold text-red-400"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'posts' && (
          <div>
            {posts.length === 0 ? (
              <div className="mt-10 text-center">
                <div className="text-5xl">📮</div>
                <p className="mt-3 text-sm font-bold text-gray-500">
                  还没有发布过帖子，去社区分享你的作品吧～
                </p>
                <Link
                  href="/community"
                  className="mt-4 inline-block rounded-xl bg-[#FF9F43] px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-orange-200"
                >
                  去社区
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {posts.map((post) => (
                  <div key={post.id} className="rounded-2xl bg-white p-4 shadow-sm border border-gray-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-800">{post.body || '啾友的作品'}</p>
                        <p className="mt-1 text-xs text-gray-400">{formatTime(post.createdAt)}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span className="text-xs text-gray-400">⭐ {post.likeCount}</span>
                        <button
                          type="button"
                          onClick={() => void removePost(post.id)}
                          className="text-xs font-bold text-red-400"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
