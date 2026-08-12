'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import {
  listNotifications,
  logoutMockUser,
  updateMockUser,
  useMockSlice,
  useMockUser,
  type StoredNotification,
} from '@/lib/client/mock-social';
import { AVATAR_CHOICES, generateAvatar } from '@/lib/client/avatars';
import { ensureSession } from '@/lib/client/session';
import { GENRE_LABELS, MOOD_LABELS } from '@/lib/constants';
import {
  deleteWorkshopWork,
  readWorkshopWorks,
} from '@/lib/workshop/storage';
import type { PublishedWork } from '@/lib/workshop/works';

type MyPost = {
  id: string;
  body: string;
  createdAt: string;
  likeCount: number;
};

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

function notificationText(type: StoredNotification['type']): string {
  switch (type) {
    case 'post_like':
      return '赞了你的帖子';
    case 'post_favorite':
      return '收藏了你的帖子';
    case 'comment_like':
      return '赞了你的评论';
    case 'comment_reply':
      return '回复了你的评论';
    case 'comment':
      return '评论了你的帖子';
  }
}

export default function MePage() {
  const router = useRouter();
  const mockUser = useMockUser();
  const fragments = useMockSlice<{ 绒羽: number; 怪羽: number; 暗羽: number }>(() => {
    if (typeof window === 'undefined') return { 绒羽: 0, 怪羽: 0, 暗羽: 0 };
    const raw = window.localStorage.getItem('jiu_state');
    if (!raw) return { 绒羽: 0, 怪羽: 0, 暗羽: 0 };
    try {
      const parsed = JSON.parse(raw) as { fragments?: { 绒羽: number; 怪羽: number; 暗羽: number } };
      return parsed.fragments ?? { 绒羽: 0, 怪羽: 0, 暗羽: 0 };
    } catch {
      return { 绒羽: 0, 怪羽: 0, 暗羽: 0 };
    }
  });
  const unlockedBirds = useMockSlice<number[]>(() => {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem('jiu_state');
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as { unlockedBirds?: number[] };
      return parsed.unlockedBirds ?? [];
    } catch {
      return [];
    }
  });
  const notifications = useMockSlice<StoredNotification[]>(() =>
    mockUser ? listNotifications(mockUser.id) : [],
  );

  const [works, setWorks] = useState<PublishedWork[]>([]);
  const [posts, setPosts] = useState<MyPost[]>([]);
  const [showPosts, setShowPosts] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [pickingAvatar, setPickingAvatar] = useState(false);
  const [name, setName] = useState(mockUser?.displayName ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [joinDate, setJoinDate] = useState('');
  const [serverDisplayName, setServerDisplayName] = useState<string | null>(null);

  useEffect(() => {
    setName(mockUser?.displayName ?? '');
  }, [mockUser?.displayName]);

  const fetchMyPosts = useCallback(async () => {
    try {
      const response = await fetch('/api/community/posts?mine=1&limit=50');
      if (!response.ok) return;
      const payload = (await response.json()) as { posts: MyPost[] };
      setPosts(payload.posts);
    } catch {
      // Server unreachable — keep what we have.
    }
  }, []);

  // Always load workshop works + community posts for the current device.
  // The mine=1 endpoint reads the session cookie so it works for both guest
  // (server) users and email-mock users. Workshop works are keyed by deviceId.
  // No guard on mockUser — that was the bug that hid works/posts from guests.
  useEffect(() => {
    void fetchMyPosts();
    const deviceId =
      typeof window !== 'undefined' ? window.localStorage.getItem('jiu_user_id') : null;
    void readWorkshopWorks(deviceId).then(setWorks);
    void ensureSession().then((session) => {
      if (session?.createdAt) setJoinDate(formatJoinDate(session.createdAt));
      if (session?.displayName) setServerDisplayName(session.displayName);
    });
  }, [fetchMyPosts]);

  const removeWork = async (id: number) => {
    const deviceId =
      typeof window !== 'undefined' ? window.localStorage.getItem('jiu_user_id') : null;
    await deleteWorkshopWork(deviceId, id);
    setWorks((prev) => prev.filter((work) => work.id !== id));
  };

  const removePost = async (id: string) => {
    if (!window.confirm('确定删除这条帖子吗？')) return;
    try {
      const response = await fetch(`/api/community/posts/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setPosts((prev) => prev.filter((post) => post.id !== id));
      } else {
        setError('帖子删除失败，请重试');
      }
    } catch {
      setError('帖子删除失败，请重试');
    }
  };

  const saveName = () => {
    const nextName = name.trim();
    if (!nextName || nextName.length > 24) {
      setError('名字需要 1 到 24 个字符');
      return;
    }
    setSaving(true);
    try {
      updateMockUser({ displayName: nextName });
      setError('');
      setEditingName(false);
    } finally {
      setSaving(false);
    }
  };

  const logout = () => {
    logoutMockUser();
    router.replace('/login?next=/me');
  };

  const displayName =
    mockUser?.displayName ?? serverDisplayName ?? (mockUser ? '啾啾音乐人' : '游客创作者');
  const totalFragments = Object.values(fragments).reduce((sum, value) => sum + value, 0);

  return (
    <main className="jiu-page me-page px-4">
      <header className="jiu-header -mx-4 flex flex-row-reverse items-center gap-3 px-4">
        <button
          type="button"
          onClick={() => {
            if (!mockUser) {
              setEditingName(true);
              return;
            }
            setPickingAvatar(true);
          }}
          className={`relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white text-2xl shadow-md ${generateAvatar(mockUser?.id ?? '').tone}`}
          aria-label="挑选头像"
        >
          {mockUser?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mockUser.avatarUrl}
              alt="我的头像"
              className="h-full w-full object-cover"
            />
          ) : (
            generateAvatar(mockUser?.id ?? '').emoji
          )}
          <span className="absolute inset-x-0 bottom-0 bg-[#2C3E50]/75 py-0.5 text-center text-[9px] font-bold text-white">
            {mockUser ? '换头像' : '修改'}
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold tracking-[0.18em] text-[#A77950]">
            JIU CREATOR SPACE
          </p>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="truncate text-[22px] font-black text-[#263746]">{displayName}</h1>
            {mockUser ? (
              <button
                type="button"
                onClick={() => setEditingName(true)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-sm shadow-sm"
                aria-label="编辑名字"
              >
                ✎
              </button>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-[#75685D]">
            {mockUser
              ? mockUser.type === 'email'
                ? '啾啾音乐创作者'
                : '游客模式，作品会绑定到当前身份'
              : serverDisplayName
                ? '游客模式，作品会绑定到当前身份'
                : '啾世界的小游客'}
          </p>
        </div>
      </header>

      {!mockUser && (
        <section className="mt-4 rounded-3xl border border-[#F2D1AD] bg-gradient-to-r from-[#FFF1D8] to-[#EAF5EA] p-4 shadow-sm">
          <p className="text-sm font-black text-[#4A3B32]">把这段创作旅程保存下来</p>
          <p className="mt-1 text-xs leading-5 text-[#75685D]">
            注册邮箱账号后，作品、社区帖子和探索进度都不会丢。
          </p>
          <Link
            href="/login?next=/me"
            className="mt-3 inline-flex min-h-11 items-center rounded-2xl bg-[#E47A24] px-4 text-sm font-black text-white"
          >
            登录 / 注册账号
          </Link>
        </section>
      )}

      {mockUser?.type === 'email' && (
        <button
          type="button"
          disabled={saving}
          onClick={logout}
          className="mt-4 min-h-11 rounded-2xl border border-[#E8D5C2] bg-white px-4 text-sm font-black text-[#8A7666] shadow-sm"
        >
          {saving ? '正在退出...' : '退出登录'}
        </button>
      )}

      {editingName && (
        <div className="jiu-card mt-4 p-4">
          <label className="text-xs font-bold text-[#75685D]" htmlFor="display-name">
            修改名字
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="display-name"
              autoFocus
              value={name}
              maxLength={24}
              onChange={(event) => setName(event.target.value)}
              className="min-h-11 min-w-0 flex-1 rounded-2xl border border-[#E8D5C2] bg-white px-3 outline-none"
            />
            <button
              type="button"
              disabled={saving}
              onClick={saveName}
              className="rounded-2xl bg-[#FF9F43] px-4 text-sm font-black text-white"
            >
              保存
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingName(false);
                setName(mockUser?.displayName ?? '');
              }}
              className="rounded-2xl bg-[#F0E9E1] px-3 text-sm font-bold text-[#75685D]"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {error && (
        <p
          role="status"
          className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600"
        >
          {error}
        </p>
      )}

      <section className="mt-4 grid grid-cols-3 gap-2" aria-label="我的数据">
        <Stat label="我的作品" value={works.length} />
        <Stat label="已收集" value={unlockedBirds.length} />
        <Stat label="羽毛碎片" value={totalFragments} />
      </section>

      <section className="jiu-card mt-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-black text-[#352B25]">我的作品</h2>
          <Link href="/workshop" className="text-sm font-bold text-[#C87835]">
            去工坊创作
          </Link>
        </div>
        {works.length === 0 ? (
          <p className="mt-5 rounded-2xl bg-[#FFF8F0] p-4 text-center text-sm font-bold text-[#8A7666]">
            还没有云端作品，先去工坊写一首吧。
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {works.map((work) => (
              <article key={work.id} className="rounded-2xl bg-[#FFF8F0] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-black text-[#4A3B32]">{work.title}</h3>
                    <p className="mt-1 text-xs text-[#A49488]">
                      {GENRE_LABELS[work.genre] ?? work.genre} ·{' '}
                      {MOOD_LABELS[work.mood] ?? work.mood}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-bold text-[#B96221]">
                    已保存
                  </span>
                </div>
                <audio controls preload="none" className="mt-3 w-full" src={work.audio} />
                <button
                  type="button"
                  onClick={() => void removeWork(work.id)}
                  className="mt-2 inline-block text-xs font-bold text-red-400"
                >
                  删除作品
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="jiu-card mt-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-black text-[#352B25]">我的帖子</h2>
          <button
            type="button"
            onClick={() => setShowPosts((value) => !value)}
            className="text-sm font-bold text-[#C87835]"
          >
            {showPosts ? '收起' : `查看全部${posts.length ? `（${posts.length}）` : ''}`}
          </button>
        </div>
        {showPosts &&
          (posts.length === 0 ? (
            <p className="mt-4 rounded-2xl bg-[#FFF8F0] p-4 text-center text-sm text-[#8A7666]">
              还没有发布过帖子。
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {posts.map((post) => (
                <article key={post.id} className="rounded-2xl bg-[#FFF8F0] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-bold text-[#4A3B32]">
                        {post.body || '音乐作品分享'}
                      </p>
                      <p className="mt-1 text-xs text-[#A49488]">
                        ♥ {post.likeCount} · {formatTime(post.createdAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void removePost(post.id)}
                      className="shrink-0 text-xs font-bold text-red-400"
                    >
                      删除
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ))}
      </section>

      <section className="jiu-card mt-4 p-5">
        <h2 className="font-black text-[#352B25]">消息中心</h2>
        {mockUser ? (
          notifications.length === 0 ? (
            <p className="mt-4 text-sm text-[#8A7666]">暂时没有新的互动消息。</p>
          ) : (
            <div className="mt-3 space-y-2">
              {notifications.slice(0, 10).map((item) => (
                <p
                  key={item.id}
                  className="rounded-xl bg-[#FFF8F0] px-3 py-2 text-sm text-[#5C4D42]"
                >
                  <span className="font-black text-[#4A3B32]">{item.actorName || '有人'}</span>{' '}
                  {notificationText(item.type)}
                </p>
              ))}
            </div>
          )
        ) : (
          <p className="mt-4 text-sm text-[#8A7666]">登录后查看点赞、收藏、评论通知。</p>
        )}
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3">
        <Link
          href="/collection"
          className="jiu-card p-4 text-center font-black text-[#4A3B32]"
        >
          查看图鉴
        </Link>
        <Link
          href="/community"
          className="jiu-card p-4 text-center font-black text-[#4A3B32]"
        >
          进入社区
        </Link>
      </section>

      {!mockUser && joinDate && (
        <p className="mt-4 text-center text-xs text-[#A49488]">{joinDate}</p>
      )}

      {pickingAvatar && mockUser && (
        <AvatarPicker
          currentEmoji={mockUser.avatarUrl ?? generateAvatar(mockUser.id).emoji}
          onClose={() => setPickingAvatar(false)}
          onPick={(emoji) => {
            updateMockUser({ avatarUrl: emoji });
            setPickingAvatar(false);
          }}
        />
      )}
    </main>
  );
}

function AvatarPicker({
  currentEmoji,
  onClose,
  onPick,
}: {
  currentEmoji: string;
  onClose: () => void;
  onPick: (emoji: string) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-[#16202A]/55 px-0 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <section
        className="w-full max-w-lg rounded-t-[30px] bg-[#FFF9F2] p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-picker-title"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id="avatar-picker-title" className="text-lg font-black text-[#2C3E50]">
            选一个头像
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg font-bold text-[#6F655D] shadow-sm"
            aria-label="关闭选择器"
          >
            ×
          </button>
        </div>
        <p className="text-xs font-bold text-[#75685D]">
          当前头像 <span className="text-base">{currentEmoji}</span>，点下面的 emoji 替换。
        </p>
        <div className="mt-4 grid grid-cols-6 gap-3">
          {AVATAR_CHOICES.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onPick(emoji)}
              className={`grid h-12 w-12 place-items-center rounded-2xl text-2xl transition active:scale-95 ${
                emoji === currentEmoji
                  ? 'bg-[#FF9F43] text-white shadow-[0_8px_20px_rgba(255,159,67,0.25)]'
                  : 'bg-white text-[#4A3B32] shadow-sm ring-1 ring-[#F2E5D9]'
              }`}
              aria-label={`选 ${emoji} 作为头像`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="jiu-card p-3 text-center">
      <p className="text-xl font-black text-[#C87835]">{value}</p>
      <p className="mt-1 text-xs font-bold text-[#8A7666]">{label}</p>
    </div>
  );
}