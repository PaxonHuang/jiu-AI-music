'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { BirdPortrait } from '@/components/collection/BirdPortrait';
import {
  BIRDS,
  GENRE_IDS,
  GENRE_LABELS,
  INSTRUMENT_IDS,
  INSTRUMENT_LABELS,
  MOOD_IDS,
  MOOD_LABELS,
  VOICE_LABELS,
  type InstrumentId,
} from '@/lib/constants';
import { useGlobalStore } from '@/stores/globalStore';
import { ensureSession, getDeviceId } from '@/lib/client/session';
import { writeWorkshopWork } from '@/lib/workshop/storage';

type LyricsMode = 'ai' | 'write' | 'continue';
type WorkshopView = 'create' | 'generating' | 'result';
type Voice = 'female' | 'male';

interface Draft {
  title: string;
  idea: string;
  lyrics: string;
  lyricsMode: LyricsMode;
  instrumental: boolean;
  genre: string;
  mood: string;
  voice: Voice;
  instruments: InstrumentId[];
}

const GENRE_ICONS: Record<string, string> = {
  pop: '🎤', rnb: '🎶', hiphop: '🎧', rap: '🧢',
  rock: '🎸', jazz: '🎷', country: '🌾', classic: '🎼',
};
const MOOD_ICONS: Record<string, string> = {
  happy: '😊', sad: '🌧️', excited: '⚡', relaxed: '🌿',
  romantic: '🌹', powerful: '💪', mysterious: '🔮',
  nostalgic: '🍂', playful: '🫧', dreamy: '🌙',
};
const INSTRUMENT_ICONS: Record<InstrumentId, string> = {
  piano: '🎹', guitar: '🎸', drums: '🥁',
  violin: '🎻', cello: '🎻', flute: '🪈',
};
const VOICE_ICONS: Record<Voice, string> = { female: '🐦', male: '🐤' };

const IDEAS = ['我的小猫', '快乐暑假', '梦里的星球', '送给妈妈'];
const GENERATION_STEPS = ['正在分析你的故事', '正在邀请乐器朋友', '正在合成最终旋律'];
const DRAFT_KEY = 'jiu_workshop_draft';
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

async function publishToCommunity(caption: string, taskId?: string): Promise<boolean> {
  try {
    const user = await ensureSession();
    if (!user) return false;
    const response = await fetch('/api/community/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: caption, taskId }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

const DEFAULT_DRAFT: Draft = {
  title: '',
  idea: '',
  lyrics: '',
  lyricsMode: 'ai',
  instrumental: false,
  genre: 'pop',
  mood: 'happy',
  voice: 'female',
  instruments: [],
};

interface TiredDetail {
  code: number;
  message: string;
  action: string;
  requestId?: string;
}

class BirdTiredError extends Error {
  readonly detail: TiredDetail;
  constructor(detail: TiredDetail) {
    super(`bird_tired ${detail.code} ${detail.action}: ${detail.message}`);
    this.name = 'BirdTiredError';
    this.detail = detail;
  }
}

function isInstrumentId(value: string): value is InstrumentId {
  return (INSTRUMENT_IDS as readonly string[]).includes(value);
}

function sanitizeDraft(input: Partial<Draft> | null | undefined): Draft {
  if (!input) return DEFAULT_DRAFT;
  const instruments = Array.isArray(input.instruments)
    ? input.instruments.filter(isInstrumentId)
    : [];
  return {
    ...DEFAULT_DRAFT,
    ...input,
    instruments,
  };
}

function buildLyrics(theme: string) {
  const subject = theme.trim() || '一场闪闪发光的旅行';
  return `[verse]\n今天我要唱一唱，${subject}\n风从窗边轻轻走，带着愿望去远方\n\n[chorus]\n飞呀飞呀，跟着旋律出发\n每一个小小梦想，都会慢慢地长大`;
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return '00:00';
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

function labelFor(map: Record<string, string>, id: string) {
  return map[id] ?? '';
}

export default function WorkshopPage() {
  const { addFragment, currentBirdId } = useGlobalStore();
  const bird = BIRDS.find((item) => item.id === currentBirdId) ?? BIRDS[0];
  const birdPortraitIndex = bird.atlasPosition.row * 3 + bird.atlasPosition.column + 1;
  const selectedBirdPortrait = `/images/birds/${birdPortraitIndex}.png`;
  const [draft, setDraft] = useState<Draft>(DEFAULT_DRAFT);
  const [view, setView] = useState<WorkshopView>('create');
  const [draftReady, setDraftReady] = useState(false);
  const [saved, setSaved] = useState(true);
  const [generateStep, setGenerateStep] = useState(0);
  const [generated, setGenerated] = useState(false);
  const [resultTitle, setResultTitle] = useState('');
  const [resultTaskId, setResultTaskId] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [predictedWaitTime, setPredictedWaitTime] = useState<number | null>(null);
  const [tiredError, setTiredError] = useState<TiredDetail | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showPublish, setShowPublish] = useState(false);
  const [publishText, setPublishText] = useState('我的新歌完成啦！');
  const [publishEmoji, setPublishEmoji] = useState('🎵');
  const [published, setPublished] = useState(false);
  const [toast, setToast] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const taskIdRef = useRef<string | null>(null);
  const generationRef = useRef(0);

  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(DRAFT_KEY);
      if (savedDraft) setDraft(sanitizeDraft(JSON.parse(savedDraft) as Partial<Draft>));
    } catch {
      // A fresh draft is safe if local storage is unavailable or malformed.
    } finally {
      setDraftReady(true);
    }
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    setSaved(false);
    const timer = window.setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      setSaved(true);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [draft, draftReady]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const isReady = useMemo(() => {
    if (draft.instrumental) return Boolean(draft.idea.trim() || true); // instrumental always ready (text is required server-side)
    if (draft.lyricsMode === 'ai') return Boolean(draft.idea.trim() || draft.lyrics.trim());
    return Boolean(draft.lyrics.trim());
  }, [draft]);

  const updateDraft = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const selectIdea = (idea: string) => {
    setDraft((current) => ({ ...current, idea, lyrics: '' }));
  };

  const createLyrics = () => {
    if (!draft.idea.trim()) {
      setToast('先告诉小鸟你想唱什么吧');
      return;
    }
    updateDraft('lyrics', buildLyrics(draft.idea));
    setToast('歌词写好啦，你还可以继续修改');
  };

  const continueLyrics = () => {
    if (!draft.lyrics.trim()) {
      setToast('先写下一两句，小鸟才能接着写');
      return;
    }
    updateDraft(
      'lyrics',
      `${draft.lyrics.trim()}\n\n【新的段落】\n云朵把歌声轻轻收藏\n明天醒来又是晴朗`,
    );
    setToast('小鸟接着写了四句');
  };

  const toggleInstrument = (id: InstrumentId) => {
    setDraft((current) => {
      if (current.instruments.includes(id)) {
        return { ...current, instruments: current.instruments.filter((item) => item !== id) };
      }
      if (current.instruments.length >= 2) {
        setToast('最多邀请两种主乐器哦');
        return current;
      }
      return { ...current, instruments: [...current.instruments, id] };
    });
  };

  const buildPayload = (d: Draft) => {
    const genre = labelFor(GENRE_LABELS, d.genre) || undefined;
    const mood = labelFor(MOOD_LABELS, d.mood) || undefined;
    const instrumentLabels = d.instruments
      .map((id) => INSTRUMENT_LABELS[id])
      .filter(Boolean);
    if (d.instrumental) {
      return {
        track: 'instrumental' as const,
        text: d.idea.trim() || '一首温暖、轻柔的儿童纯音乐',
        genre,
        mood,
        instruments: instrumentLabels,
        modelVersion: 'v5.0' as const,
      };
    }
    const lyrics = d.lyrics.trim() || buildLyrics(d.idea);
    return {
      track: 'vocal' as const,
      lyrics,
      genre,
      mood,
      gender: d.voice === 'female' ? 'Female' : 'Male',
      instruments: instrumentLabels,
      modelVersion: 'v4.0' as const,
      lang: 'Chinese',
      vodFormat: 'wav' as const,
    };
  };

  async function submitCreate(payload: ReturnType<typeof buildPayload>): Promise<{ taskId: string; predictedWaitTime: number }> {
    const res = await fetch('/api/music/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.status === 502) {
      const data = (await res.json()) as { message?: string; detail: TiredDetail };
      throw new BirdTiredError({ ...data.detail, message: data.message ?? data.detail.message });
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`create_failed ${res.status} ${text}`);
    }
    return res.json() as Promise<{ taskId: string; predictedWaitTime: number }>;
  }

  async function pollUntilDone(taskId: string, startedAt: number): Promise<{ audioUrl?: string }> {
    while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
      if (taskIdRef.current !== taskId) {
        // cancelled
        throw new Error('cancelled');
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      if (taskIdRef.current !== taskId) {
        throw new Error('cancelled');
      }
      const res = await fetch(`/api/music/status/${encodeURIComponent(taskId)}`);
      if (res.status === 502) {
        const data = (await res.json()) as { message?: string; detail: TiredDetail };
        throw new BirdTiredError({ ...data.detail, message: data.message ?? data.detail.message });
      }
      if (!res.ok) {
        throw new Error(`status_failed ${res.status}`);
      }
      const data = (await res.json()) as {
        status: 'pending' | 'running' | 'success' | 'failed' | 'unknown';
        progress: number;
        audioUrl?: string;
        failureReason?: { code: number; msg: string } | null;
      };
      // Map progress to the 3-step indicator. Steps roughly: 0-30% (analyzing),
      // 30-80% (inviting instruments), 80-100% (composing).
      if (data.status === 'pending' || data.status === 'running') {
        if (data.progress >= 80) setGenerateStep(2);
        else if (data.progress >= 30) setGenerateStep(1);
        else setGenerateStep(0);
      } else if (data.status === 'success') {
        setGenerateStep(2);
        return { audioUrl: data.audioUrl };
      } else if (data.status === 'failed') {
        throw new Error(data.failureReason?.msg ?? 'generation_failed');
      }
    }
    throw new Error('timeout');
  }

  const handleGenerate = async () => {
    if (!isReady) {
      setToast('先写下你的歌曲故事吧');
      return;
    }
    const finalLyrics = draft.instrumental
      ? ''
      : draft.lyrics.trim() || buildLyrics(draft.idea);
    if (finalLyrics !== draft.lyrics) updateDraft('lyrics', finalLyrics);

    const generationId = ++generationRef.current;
    setGenerateStep(0);
    setView('generating');
    setIsPlaying(false);
    setAudioUrl(null);
    setResultTaskId(null);
    setPredictedWaitTime(null);
    setTiredError(null);

    try {
      const payload = buildPayload(draft);
      const { taskId, predictedWaitTime: wait } = await submitCreate(payload);
      taskIdRef.current = taskId;
      setResultTaskId(taskId);
      setPredictedWaitTime(wait);
      const startedAt = Date.now();
      const { audioUrl: resultAudioUrl } = await pollUntilDone(taskId, startedAt);
      if (generationRef.current !== generationId) return;
      if (resultAudioUrl) setAudioUrl(resultAudioUrl);
      setResultTitle(draft.title.trim() || (draft.instrumental ? '会飞的旋律' : '星光小旅行'));
      setGenerated(true);
      setView('result');
      setCurrentTime(0);
    } catch (err) {
      taskIdRef.current = null;
      if (err instanceof BirdTiredError) {
        setTiredError(err.detail);
        setView('create');
        return;
      }
      if ((err as Error).message === 'cancelled') return;
      setToast('生成失败，请稍后再试');
      setView('create');
    }
  };

  const cancelGeneration = () => {
    generationRef.current += 1;
    taskIdRef.current = null;
    setView('create');
    setToast('创作已暂停，灵感都还在');
  };

  const dismissTired = () => setTiredError(null);

  const simplifyAndRetry = () => {
    setDraft((current) => ({
      ...current,
      instruments: [],
      lyrics: '',
      instrumental: true,
    }));
    setTiredError(null);
    setToast('已简化需求，记得写下场景描述再试一次');
  };

  const togglePlay = async () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }
    try {
      await audioRef.current.play();
      setIsPlaying(true);
    } catch {
      setToast('暂时无法播放，请再试一次');
    }
  };

  const seekAudio = (value: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = value;
    setCurrentTime(value);
  };

  const persistWork = (status: 'saved' | 'published') => {
    if (!audioUrl) return false;
    const work = {
      id: Date.now(),
      title: resultTitle,
      lyrics: draft.lyrics,
      genre: draft.genre,
      mood: draft.mood,
      instruments: draft.instruments,
      status,
      audio: audioUrl,
      taskId: resultTaskId ?? undefined,
      caption: status === 'published' ? publishText.trim() : '',
      emoji: status === 'published' ? publishEmoji : '🎵',
      createdAt: new Date().toISOString(),
    };
    writeWorkshopWork(getDeviceId(), work);
    return true;
  };

  const saveWork = () => {
    if (!persistWork('saved')) {
      setToast('音频还没有准备好，请稍后再保存');
      return;
    }
    setToast('已经保存到作品集');
  };

  const publishWork = () => {
    if (!persistWork('published')) {
      setToast('音频还没有准备好，请稍后再试');
      return;
    }
    // Best-effort sync to the community feed. Failing that, the work stays in
    // the local library and publishing still counts as complete.
    void publishToCommunity(publishText.trim(), resultTaskId ?? undefined);
    if (!published) {
      addFragment('怪羽', 3);
      setPublished(true);
    }
    setShowPublish(false);
    setToast(`${publishEmoji} 发布成功，获得怪羽碎片 ×3`);
  };

  const selectedInstrumentNames = draft.instruments
    .map((id) => labelFor(INSTRUMENT_LABELS, id))
    .filter(Boolean)
    .join('、');

  return (
    <main className="jiu-page text-[#263746]">
      {view !== 'generating' && (
        <header className="jiu-header">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold tracking-[0.18em] text-[#A77950]">JIU MUSIC WORKSHOP</p>
              <h1 className="mt-0.5 text-[22px] font-black tracking-tight text-[#263746]">音乐工坊</h1>
              <p className="mt-0.5 text-xs text-[#67594E]">把你的故事变成一首歌</p>
            </div>
            <div className="jiu-status-badge flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold">
              <span className={`h-2 w-2 rounded-full ${saved ? 'bg-[#2ED573]' : 'animate-pulse bg-[#FF9F43]'}`} />
              {saved ? '已保存' : '保存中'}
            </div>
          </div>

          {generated && (
            <div className="mt-3 grid grid-cols-2 rounded-xl bg-[#F3EADF] p-1" role="tablist" aria-label="工坊页面">
              <button
                type="button"
                role="tab"
                aria-selected={view === 'create'}
                onClick={() => setView('create')}
                className={`min-h-10 rounded-lg text-sm font-bold transition ${view === 'create' ? 'bg-white text-[#E87824] shadow-sm' : 'text-[#8A7666]'}`}
              >
                继续创作
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === 'result'}
                onClick={() => setView('result')}
                className={`min-h-10 rounded-lg text-sm font-bold transition ${view === 'result' ? 'bg-white text-[#E87824] shadow-sm' : 'text-[#8A7666]'}`}
              >
                试听作品
              </button>
            </div>
          )}
        </header>
      )}

      {view === 'create' && (
        <section className="jiu-partner-card" aria-label="当前音乐伙伴">
          <div className="relative z-10 flex min-w-0 flex-1 flex-col items-start justify-center py-4 pl-5">
            <span className="rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-black text-[#52715E]">
              CURRENT PARTNER · 当前伙伴
            </span>
            <h2 className="mt-2 text-lg font-black tracking-tight text-[#263746]">
              和{bird.name}一起创作
            </h2>
            <p className="mt-1 max-w-[205px] text-xs leading-5 text-[#67594E]">
              它会陪你读歌词、挑乐器，把灵感变成音乐。
            </p>
          </div>
          <div className="relative z-10 -mr-2 flex w-[34%] shrink-0 items-end justify-center self-stretch">
            <Image
              src={selectedBirdPortrait}
              alt={bird.name}
              width={160}
              height={160}
              unoptimized
              className="h-full w-full object-contain object-bottom"
            />
          </div>
          <div className="absolute -right-5 -top-8 h-28 w-28 rounded-full bg-white/35" aria-hidden="true" />
          <div className="absolute -bottom-10 left-1/3 h-24 w-24 rounded-full bg-[#61AC7F]/10" aria-hidden="true" />
        </section>
      )}

      <AnimatePresence mode="wait">
        {view === 'create' && (
          <motion.div
            key="create"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4 px-4 pb-40 pt-4"
          >
            <section className="jiu-card overflow-hidden">
              <div className="flex items-start justify-between gap-4 border-b border-[#F5ECE4] bg-gradient-to-r from-[#FFF5E9] to-white p-4">
                <div className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FF9F43] text-sm font-black text-white">1</span>
                  <div>
                    <h2 className="font-extrabold">写下你的故事</h2>
                    <p className="mt-0.5 text-xs text-[#8A7666]">一句话也可以，小鸟会帮你写完整</p>
                  </div>
                </div>
                <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-bold text-[#6B7280]">
                  纯音乐
                  <input
                    type="checkbox"
                    checked={draft.instrumental}
                    onChange={(event) => updateDraft('instrumental', event.target.checked)}
                    className="peer sr-only"
                  />
                  <span className="relative h-7 w-12 rounded-full bg-[#D8D8D8] transition peer-checked:bg-[#52715E] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#52715E] after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:after:translate-x-5" />
                </label>
              </div>

              <div className="space-y-4 p-4">
                {!draft.instrumental ? (
                  <>
                    <div className="grid grid-cols-3 rounded-xl bg-[#F8F4EF] p-1" role="tablist" aria-label="歌词创作方式">
                      {([
                        ['ai', 'AI 帮我写'],
                        ['write', '自己写'],
                        ['continue', 'AI 续写'],
                      ] as const).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          role="tab"
                          aria-selected={draft.lyricsMode === id}
                          onClick={() => updateDraft('lyricsMode', id)}
                          className={`min-h-10 rounded-lg px-1 text-sm font-bold transition ${draft.lyricsMode === id ? 'bg-white text-[#E87824] shadow-sm' : 'text-[#8A7666]'}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {draft.lyricsMode === 'ai' ? (
                      <div className="space-y-3">
                        <label className="block">
                          <span className="sr-only">歌曲主题或故事</span>
                          <textarea
                            value={draft.idea}
                            maxLength={160}
                            onChange={(event) => setDraft((current) => ({ ...current, idea: event.target.value, lyrics: '' }))}
                            placeholder="例如：写一首关于暑假和好朋友的开心歌曲……"
                            className="min-h-32 w-full resize-none rounded-2xl border-2 border-[#F0E5DA] bg-[#FFFCF8] p-4 text-base leading-7 outline-none transition placeholder:text-[#B7AAA0] focus:border-[#FFB56F]"
                          />
                        </label>
                        <div className="flex flex-wrap gap-2" aria-label="歌曲灵感">
                          {IDEAS.map((idea) => (
                            <button
                              key={idea}
                              type="button"
                              onClick={() => selectIdea(idea)}
                              className="min-h-10 rounded-full bg-[#FFF1DE] px-3 text-sm font-semibold text-[#A55A1F] active:scale-95"
                            >
                              {idea}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={createLyrics}
                          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#FFC78F] bg-[#FFF8EF] text-sm font-bold text-[#D96D1C] active:scale-[0.98]"
                        >
                          <span aria-hidden="true">✨</span> 先看看 AI 写的歌词
                        </button>
                        {draft.lyrics && (
                          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-[#FFF8E7] p-4 ring-1 ring-[#F4DEB6]">
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-xs font-extrabold text-[#A66B16]">小鸟写好的歌词</span>
                              <button type="button" onClick={() => updateDraft('lyricsMode', 'write')} className="min-h-9 px-2 text-xs font-bold text-[#E87824]">
                                修改歌词
                              </button>
                            </div>
                            <p className="whitespace-pre-line text-sm leading-6 text-[#665548]">{draft.lyrics}</p>
                          </motion.div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <label className="block">
                          <span className="sr-only">歌曲歌词</span>
                          <textarea
                            value={draft.lyrics}
                            maxLength={600}
                            onChange={(event) => updateDraft('lyrics', event.target.value)}
                            placeholder={draft.lyricsMode === 'continue' ? '先写下一两句，小鸟会接着你的故事写……' : '在这里写下你的歌词……'}
                            className="min-h-44 w-full resize-none rounded-2xl border-2 border-[#F0E5DA] bg-[#FFFCF8] p-4 text-base leading-7 outline-none transition placeholder:text-[#B7AAA0] focus:border-[#FFB56F]"
                          />
                          <span className="mt-1 block text-right text-xs text-[#A89B90]">{draft.lyrics.length}/600</span>
                        </label>
                        {draft.lyricsMode === 'continue' && (
                          <button
                            type="button"
                            onClick={continueLyrics}
                            className="min-h-11 w-full rounded-xl bg-[#FFF1DE] text-sm font-bold text-[#D96D1C] active:scale-[0.98]"
                          >
                            ✨ 接着这一段写
                          </button>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-[#665548]">描述你想听到的画面（选填）</span>
                    <textarea
                      value={draft.idea}
                      maxLength={160}
                      onChange={(event) => updateDraft('idea', event.target.value)}
                      placeholder="例如：在森林里散步时，轻松又梦幻的音乐……"
                      className="min-h-28 w-full resize-none rounded-2xl border-2 border-[#D7EBDF] bg-[#F6FBF7] p-4 text-base leading-7 outline-none placeholder:text-[#7F9A89] focus:border-[#7AA48A]"
                    />
                  </label>
                )}

                <label className="block border-t border-[#F5ECE4] pt-4">
                  <span className="mb-2 flex items-center gap-2 text-sm font-bold text-[#665548]">
                    歌名 <span className="text-xs font-medium text-[#A89B90]">选填，小鸟也可以帮你取</span>
                  </span>
                  <input
                    type="text"
                    value={draft.title}
                    maxLength={50}
                    onChange={(event) => updateDraft('title', event.target.value)}
                    placeholder="给歌曲起一个名字"
                    className="min-h-12 w-full rounded-xl border-2 border-[#F0E5DA] bg-[#FFFCF8] px-4 text-base outline-none placeholder:text-[#B7AAA0] focus:border-[#FFB56F]"
                  />
                </label>
              </div>
            </section>

            <section className="jiu-card p-4">
              <div className="mb-4 flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#52715E] text-sm font-black text-white">2</span>
                <div>
                  <h2 className="font-extrabold">歌曲是什么感觉</h2>
                  <p className="mt-0.5 text-xs text-[#8A7666]">每一组选择都会带来不同的声音</p>
                </div>
              </div>

              <fieldset>
                <legend className="mb-2 text-sm font-extrabold text-[#665548]">曲风</legend>
                <div className="grid grid-cols-3 gap-2">
                  {GENRE_IDS.map((id) => {
                    const active = draft.genre === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => updateDraft('genre', id)}
                        className={`relative min-h-[58px] rounded-xl border-2 px-1 text-sm font-bold transition active:scale-95 ${active ? 'border-[#52715E] bg-[#DFF3EF] text-[#3F6351]' : 'border-[#EEE6DF] bg-[#FCFAF8] text-[#6B625C]'}`}
                      >
                        <span className="mr-1" aria-hidden="true">{GENRE_ICONS[id]}</span>{GENRE_LABELS[id]}
                        {active && <span className="absolute right-1.5 top-1 text-[10px] text-[#52715E]">●</span>}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset className="mt-5">
                <legend className="mb-2 text-sm font-extrabold text-[#665548]">情绪</legend>
                <div className="grid grid-cols-3 gap-2">
                  {MOOD_IDS.map((id) => {
                    const active = draft.mood === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => updateDraft('mood', id)}
                        className={`relative min-h-[58px] rounded-xl border-2 px-1 text-sm font-bold transition active:scale-95 ${active ? 'border-[#52715E] bg-[#DFF3EF] text-[#3F6351]' : 'border-[#EEE6DF] bg-[#FCFAF8] text-[#6B625C]'}`}
                      >
                        <span className="mr-1" aria-hidden="true">{MOOD_ICONS[id]}</span>{MOOD_LABELS[id]}
                        {active && <span className="absolute right-1.5 top-1 text-[10px] text-[#52715E]">●</span>}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </section>

            <section className="jiu-card p-4">
              <div className="mb-4 flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#A785E5] text-sm font-black text-white">3</span>
                <div>
                  <h2 className="font-extrabold">挑选声音</h2>
                  <p className="mt-0.5 text-xs text-[#8A7666]">邀请喜欢的歌手和乐器朋友</p>
                </div>
              </div>

              {!draft.instrumental && (
                <fieldset>
                  <legend className="mb-2 text-sm font-extrabold text-[#665548]">人声</legend>
                  <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#F8F4EF] p-1.5">
                    {(Object.keys(VOICE_LABELS) as Voice[]).map((id) => (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={draft.voice === id}
                        onClick={() => updateDraft('voice', id)}
                        className={`min-h-12 rounded-xl text-sm font-extrabold transition active:scale-95 ${draft.voice === id ? 'bg-white text-[#7A54B3] shadow-sm ring-1 ring-[#D9C8F2]' : 'text-[#786C64]'}`}
                      >
                        <span className="mr-1" aria-hidden="true">{VOICE_ICONS[id]}</span>{VOICE_LABELS[id]}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}

              <fieldset className={draft.instrumental ? '' : 'mt-5'}>
                <legend className="mb-2 flex w-full items-center justify-between text-sm font-extrabold text-[#665548]">
                  <span>主乐器</span>
                  <span className={`text-xs ${draft.instruments.length === 2 ? 'text-[#E87824]' : 'text-[#A89B90]'}`}>已选 {draft.instruments.length}/2</span>
                </legend>
                <div className="grid grid-cols-3 gap-2">
                  {INSTRUMENT_IDS.map((id) => {
                    const active = draft.instruments.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleInstrument(id)}
                        className={`relative min-h-[62px] rounded-xl border-2 text-sm font-bold transition active:scale-95 ${active ? 'border-[#A785E5] bg-[#F4EEFF] text-[#6D4AA1]' : 'border-[#EEE6DF] bg-[#FCFAF8] text-[#6B625C]'}`}
                      >
                        <span className="mb-0.5 block text-xl" aria-hidden="true">{INSTRUMENT_ICONS[id]}</span>
                        {INSTRUMENT_LABELS[id]}
                        {active && <span className="absolute right-1.5 top-1 text-xs text-[#8F67C8]">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </section>
          </motion.div>
        )}

        {view === 'result' && (
          <motion.div
            key="result"
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            className="px-4 pb-40 pt-5"
          >
            <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_12px_36px_rgba(126,88,54,0.12)] ring-1 ring-[#F2E5D9]">
              <div className="relative mx-auto mt-5 aspect-square w-[76%] max-w-[290px] overflow-hidden rounded-[28px] bg-[radial-gradient(circle_at_30%_20%,#FFF3C4_0%,#F8B56B_35%,#D77EAE_100%)] shadow-[0_16px_30px_rgba(174,106,89,0.22)]">
                <div className="absolute -left-4 top-8 h-24 w-24 rounded-full bg-white/20" />
                <div className="absolute -right-8 bottom-10 h-32 w-32 rounded-full bg-[#7BD7D0]/35" />
                <div className="absolute left-5 top-4 rotate-[-12deg] text-3xl text-white/90">♪</div>
                <div className="absolute right-6 top-8 rotate-12 text-4xl text-white/90">♫</div>
                <BirdPortrait bird={bird} className="absolute inset-x-6 bottom-2 top-10" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#7F4265]/65 to-transparent px-5 pb-4 pt-12 text-center text-xs font-bold tracking-[0.22em] text-white/90">JIU ORIGINAL</div>
              </div>

              <div className="px-5 pb-5 pt-5 text-center">
                <h2 className="text-2xl font-black tracking-tight text-[#352B25]">《{resultTitle}》</h2>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-xs font-bold text-[#7A6B61]">
                  <span className="rounded-full bg-[#FFF1DE] px-2.5 py-1">{labelFor(GENRE_LABELS, draft.genre)}</span>
                  <span className="rounded-full bg-[#DFF3EF] px-2.5 py-1 text-[#3F6351]">{labelFor(MOOD_LABELS, draft.mood)}</span>
                  {selectedInstrumentNames && <span className="rounded-full bg-[#F4EEFF] px-2.5 py-1">{selectedInstrumentNames}</span>}
                </div>

                <audio
                  ref={audioRef}
                  src={audioUrl ?? undefined}
                  preload="metadata"
                  onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
                  onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                  onEnded={() => setIsPlaying(false)}
                />

                <div className="mt-6 rounded-2xl bg-[#FFF9F2] p-4">
                  <input
                    type="range"
                    min={0}
                    max={duration || 1}
                    step={0.1}
                    value={Math.min(currentTime, duration || 1)}
                    onChange={(event) => seekAudio(Number(event.target.value))}
                    aria-label="歌曲播放进度"
                    className="h-2 w-full cursor-pointer accent-[#FF9F43]"
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <span className="w-12 text-left text-xs font-semibold text-[#8A7B70]">{formatTime(currentTime)}</span>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.92 }}
                      onClick={togglePlay}
                      aria-label={isPlaying ? '暂停歌曲' : '播放歌曲'}
                      className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#FFAD57] to-[#F47B43] text-2xl text-white shadow-[0_8px_20px_rgba(244,123,67,0.35)]"
                    >
                      {isPlaying ? 'Ⅱ' : '▶'}
                    </motion.button>
                    <span className="w-12 text-right text-xs font-semibold text-[#8A7B70]">{formatTime(duration)}</span>
                  </div>
                </div>
              </div>
            </section>

            {!draft.instrumental && (
              <section className="jiu-card mt-4 p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-extrabold">同步歌词</h3>
                  <span className="rounded-full bg-[#FFF1DE] px-2.5 py-1 text-xs font-bold text-[#C7631A]">正在演唱</span>
                </div>
                <div className="max-h-52 overflow-y-auto rounded-2xl bg-[#FFFCF8] p-4 text-center text-sm leading-8 text-[#8A7B70]">
                  {draft.lyrics.split('\n').map((line, index) => (
                    <p key={`${line}-${index}`} className={index === 1 && isPlaying ? 'font-extrabold text-[#E87824]' : ''}>
                      {line || '\u00A0'}
                    </p>
                  ))}
                </div>
              </section>
            )}

            <button
              type="button"
              onClick={() => setView('create')}
              className="mt-4 min-h-12 w-full rounded-2xl text-sm font-extrabold text-[#8A6B55] active:bg-white/70"
            >
              ↻ 调整后重新生成
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {view === 'create' && (
        <div className="jiu-action-bar fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] left-1/2 z-30 w-full max-w-lg -translate-x-1/2 p-3">
          <button
            type="button"
            onClick={handleGenerate}
            aria-disabled={!isReady}
            className={`flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-black shadow-lg transition active:scale-[0.98] ${isReady ? 'bg-gradient-to-r from-[#FF9F43] to-[#F47B43] text-white shadow-orange-200' : 'bg-[#E5DED7] text-[#A99E95] shadow-none'}`}
          >
            <span aria-hidden="true">✨</span> 让小鸟开始创作
          </button>
        </div>
      )}

      {view === 'result' && (
        <div className="jiu-action-bar fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] left-1/2 z-30 grid w-full max-w-lg -translate-x-1/2 grid-cols-[0.9fr_1.4fr] gap-2 p-3">
          <button type="button" onClick={saveWork} className="min-h-14 rounded-2xl border-2 border-[#FFC98F] bg-white text-sm font-black text-[#B96221] active:scale-[0.98]">
            保存作品
          </button>
          <button type="button" onClick={() => setShowPublish(true)} className="min-h-14 rounded-2xl bg-gradient-to-r from-[#FF9F43] to-[#F47B43] text-sm font-black text-white shadow-lg shadow-orange-200 active:scale-[0.98]">
            发布到社区
          </button>
        </div>
      )}

      <AnimatePresence>
        {view === 'generating' && (
          <motion.section
            key="generating"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_32%,#FFF8D7_0%,#FFF1DE_38%,#EAF5FF_100%)] px-8 text-center"
            aria-live="polite"
          >
            <div className="absolute left-8 top-24 text-3xl text-[#F5A04F]/60">♪</div>
            <div className="absolute right-10 top-36 text-4xl text-[#6AAFEF]/55">♫</div>
            <div className="absolute bottom-28 left-14 text-2xl text-[#A785E5]/55">♩</div>
            <motion.div
              animate={{ y: [0, -12, 0], rotate: [-2, 3, -2] }}
              transition={{ duration: 1.7, repeat: Infinity, ease: 'easeInOut' }}
              className="relative h-52 w-52"
            >
              <div className="absolute inset-0 rounded-full bg-white/65 shadow-[0_16px_44px_rgba(210,139,78,0.2)] ring-8 ring-white/35" />
              <div className="absolute inset-4 rounded-full bg-gradient-to-br from-white/80 via-[#FFF7D6]/75 to-[#DDF4FF]/75" />
              <motion.div
                animate={{ scale: [1, 1.04, 1], rotate: [-1, 1, -1] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-7 flex items-center justify-center"
              >
                <Image
                  key={currentBirdId}
                  src={selectedBirdPortrait}
                  alt={bird.name}
                  fill
                  sizes="176px"
                  priority
                  unoptimized
                  className="h-full w-full object-contain drop-shadow-[0_12px_12px_rgba(103,78,58,0.22)]"
                />
              </motion.div>
              <motion.div
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -right-6 top-2 rounded-2xl rounded-bl-md bg-white px-3 py-2 text-xs font-extrabold text-[#6B5548] shadow-md ring-1 ring-[#F2E5D9]"
              >
                我来帮你排练！
              </motion.div>
            </motion.div>
            <p className="mt-6 text-xl font-black text-[#3F352E]">{GENERATION_STEPS[generateStep]}…</p>
            <p className="mt-2 text-sm font-semibold text-[#8A7666]">
              {predictedWaitTime
                ? `预计需要约 ${Math.max(1, Math.round(predictedWaitTime))} 秒，请耐心等待`
                : '通常需要一点时间，请听听小鸟的排练声'}
            </p>
            <div className="mt-8 w-full max-w-xs space-y-3 text-left">
              {GENERATION_STEPS.map((step, index) => (
                <div key={step} className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition ${index === generateStep ? 'bg-white shadow-sm' : ''}`}>
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${index < generateStep ? 'bg-[#2ED573] text-white' : index === generateStep ? 'animate-pulse bg-[#FF9F43] text-white' : 'bg-white/70 text-[#B6A89D]'}`}>
                    {index < generateStep ? '✓' : index + 1}
                  </span>
                  <span className={`text-sm font-bold ${index <= generateStep ? 'text-[#5C4D42]' : 'text-[#A99B91]'}`}>{step}</span>
                </div>
              ))}
            </div>
            <button type="button" onClick={cancelGeneration} className="mt-8 min-h-12 px-6 text-sm font-bold text-[#8A7666] underline decoration-[#CBB8A9] underline-offset-4">
              暂停创作
            </button>
          </motion.section>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPublish && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-end justify-center bg-black/35 p-0"
            onClick={() => setShowPublish(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="publish-title"
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-lg rounded-t-[28px] bg-[#FFF9F2] px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-3 shadow-2xl"
            >
              <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#D8CCC2]" />
              <h2 id="publish-title" className="text-xl font-black">把作品分享给大家</h2>
              <p className="mt-1 text-sm text-[#8A7666]">加一句话和一个心情，让朋友发现你的音乐。</p>
              <div className="mt-4 flex gap-2" aria-label="发布心情">
                {['🎵', '🌟', '😊', '🚀', '🌈'].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    aria-pressed={publishEmoji === emoji}
                    onClick={() => setPublishEmoji(emoji)}
                    className={`h-12 flex-1 rounded-xl text-xl ${publishEmoji === emoji ? 'bg-[#FFF1DE] ring-2 ring-[#FF9F43]' : 'bg-white ring-1 ring-[#EDE3DA]'}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <textarea
                value={publishText}
                maxLength={100}
                onChange={(event) => setPublishText(event.target.value)}
                className="mt-4 min-h-24 w-full resize-none rounded-2xl border-2 border-[#F0E5DA] bg-white p-4 text-base outline-none focus:border-[#FFB56F]"
                aria-label="发布配文"
              />
              <div className="mt-4 grid grid-cols-[0.8fr_1.2fr] gap-2">
                <button type="button" onClick={() => setShowPublish(false)} className="min-h-13 rounded-2xl bg-white font-bold text-[#77685D] ring-1 ring-[#E8DDD4]">再想想</button>
                <button type="button" onClick={publishWork} className="min-h-13 rounded-2xl bg-[#FF9F43] font-black text-white shadow-lg shadow-orange-200">确认发布</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            role="status"
            className="fixed left-1/2 top-[calc(1rem+env(safe-area-inset-top,0px))] z-[90] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-2xl bg-[#2C3E50] px-4 py-3 text-center text-sm font-bold text-white shadow-xl"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {tiredError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-end justify-center bg-black/35 p-0"
            onClick={dismissTired}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="tired-title"
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-lg rounded-t-[28px] bg-[#FFF9F2] px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-3 shadow-2xl"
            >
              <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#D8CCC2]" />
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFE4D1] text-2xl" aria-hidden="true">🐦</div>
                <div className="flex-1">
                  <h2 id="tired-title" className="text-lg font-black text-[#3F2E22]">小鸟累了，请换个组合再试一次</h2>
                  <p className="mt-0.5 text-xs text-[#8A7666]">刚刚的请求暂时无法完成（{tiredError.action}）</p>
                </div>
              </div>
              <p className="mt-4 rounded-2xl bg-[#FFF1DE] px-4 py-3 text-sm leading-6 text-[#6B5548]">
                试试减少乐器数量、换成纯音乐模式，或者把故事写得再具体一点。
              </p>
              {process.env.NODE_ENV !== 'production' && (
                <p className="mt-2 px-1 text-[10px] text-[#B6A89D]">code: {tiredError.code} · req: {tiredError.message}</p>
              )}
              <div className="mt-4 grid grid-cols-[0.9fr_1.1fr] gap-2">
                <button
                  type="button"
                  onClick={dismissTired}
                  className="min-h-13 rounded-2xl bg-white font-bold text-[#77685D] ring-1 ring-[#E8DDD4]"
                >
                  我再试试
                </button>
                <button
                  type="button"
                  onClick={simplifyAndRetry}
                  className="min-h-13 rounded-2xl bg-[#FF9F43] font-black text-white shadow-lg shadow-orange-200"
                >
                  帮我简化需求
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
