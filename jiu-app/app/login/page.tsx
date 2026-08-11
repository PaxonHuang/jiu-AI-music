'use client';

import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import {
  loginEmailAccount,
  registerEmailAccount,
  useMockUser,
} from '@/lib/client/mock-social';
import styles from './login.module.css';

type Mode = 'login' | 'register';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentUser = useMockUser();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const nextPath = safeNextPath(searchParams.get('next'));

  // If already authenticated, bounce to the requested page once on mount.
  if (currentUser && typeof window !== 'undefined') {
    queueMicrotask(() => router.replace(nextPath));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (mode === 'register' && password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    setSubmitting(true);
    try {
      const result =
        mode === 'register'
          ? await registerEmailAccount({ email, password, displayName })
          : await loginEmailAccount({ email, password });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace(nextPath);
    } catch {
      setError('网络暂时不稳定，请稍后再试');
    } finally {
      setSubmitting(false);
    }
  }

  async function continueAsGuest() {
    setError('');
    setSubmitting(true);
    try {
      const response = await fetch('/api/auth/guest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deviceId: getOrCreateDeviceId() }),
      });
      const payload = (await response.json()) as {
        user?: { id: string };
        message?: string;
      };
      if (!response.ok || !payload.user) throw new Error(payload.message ?? '游客模式暂时不可用');
      router.replace(nextPath);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '游客模式暂时不可用');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.brand}>
          <div className={styles.bird} aria-hidden="true">
            <svg width="34" height="34" viewBox="0 0 40 40" fill="none">
              <path
                d="M8 24c0-9 6-15 15-15 4 0 8 2 10 6-5-1-8 1-10 4-2 3-5 6-10 6H8v-1Z"
                fill="#52715E"
              />
              <circle cx="26" cy="15" r="1.8" fill="#263746" />
              <path
                d="M31 16.5 36 19l-5 1"
                stroke="#E47A24"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <p className="text-xs font-black tracking-[0.28em] text-[#A47754]">JIU MUSIC</p>
            <p className="mt-1 text-2xl font-black">和小鸟一起创作</p>
          </div>
        </div>

        <section className={styles.card}>
          <p className="text-sm font-black tracking-[0.14em] text-[#E47A24]">
            {mode === 'login' ? 'WELCOME BACK' : 'NEW MUSICIAN'}
          </p>
          <h1 className="mt-2 text-3xl font-black text-[#263746]">
            {mode === 'login' ? '欢迎回来，小小音乐家' : '创建你的音乐小屋'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#75685D]">
            {mode === 'login'
              ? '登录后继续保存你的作品和探索进度。'
              : '注册后，你的作品、社区分享和图鉴进度都会跟着你。'}
          </p>

          <form onSubmit={submit}>
            {mode === 'register' && (
              <label className={styles.field}>
                昵称
                <input
                  className={styles.input}
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="给自己取一个名字"
                  maxLength={24}
                  required
                />
              </label>
            )}
            <label className={styles.field}>
              邮箱
              <input
                className={styles.input}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>
            <label className={styles.field}>
              密码
              <div className={styles.passwordWrap}>
                <input
                  className={styles.input}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="至少 8 位"
                  minLength={8}
                  maxLength={72}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                />
                <button
                  className={styles.toggle}
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                >
                  {showPassword ? '隐藏' : '显示'}
                </button>
              </div>
            </label>
            {mode === 'register' && (
              <label className={styles.field}>
                确认密码
                <input
                  className={styles.input}
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="再输入一次密码"
                  minLength={8}
                  maxLength={72}
                  autoComplete="new-password"
                  required
                />
              </label>
            )}
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <button className={styles.primary} type="submit" disabled={submitting}>
              {submitting
                ? '正在进入音乐小屋...'
                : mode === 'login'
                  ? '登录'
                  : '注册并开始创作'}
            </button>
          </form>

          <button
            className={styles.secondary}
            type="button"
            onClick={() => {
              setMode((value) => (value === 'login' ? 'register' : 'login'));
              setError('');
            }}
          >
            {mode === 'login' ? '还没有账号？注册一个' : '已经有账号？直接登录'}
          </button>
          <button
            className={styles.secondary}
            type="button"
            disabled={submitting}
            onClick={() => void continueAsGuest()}
          >
            先用游客模式体验
          </button>
          <p className={styles.hint}>
            第一版暂不需要邮箱验证码，邮箱只用于识别你的账号。
          </p>
        </section>
      </div>
    </main>
  );
}

function safeNextPath(value: string | null): string {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/me';
}

function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  let uid = window.localStorage.getItem('jiu_user_id');
  if (!uid) {
    uid = crypto.randomUUID();
    window.localStorage.setItem('jiu_user_id', uid);
  }
  return uid;
}