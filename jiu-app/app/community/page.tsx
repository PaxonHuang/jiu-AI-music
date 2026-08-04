'use client';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { GENRE_LABELS, INSTRUMENT_IDS, INSTRUMENT_LABELS, MOOD_LABELS } from '@/lib/constants';

interface Work {
  id: number;
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
}

interface StoredWork {
  id: number;
  title: string;
  genre: string;
  mood: string;
  status: 'saved' | 'published';
  audio: string;
  caption?: string;
  emoji?: string;
  instruments?: string[];
  taskId?: string;
}

const DEMO_WORKS: Work[] = [
  { id: 1, title: '乡间小路', author: '小明', time: '2 分钟前', style: '😊 欢快', stars: 12, starred: false },
  { id: 2, title: '山里的风', author: '小红', time: '1 小时前', style: '🌙 安静', stars: 8, starred: false },
  { id: 3, title: '梦中的鸟', author: '小刚', time: '3 小时前', style: '✨ 梦幻', stars: 5, starred: false },
  { id: 4, title: '溪水叮咚', author: '小美', time: '5 小时前', style: '🌙 安静', stars: 3, starred: false },
];

export default function CommunityPage() {
  const [works, setWorks] = useState(DEMO_WORKS);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('jiu_workshop_works') || '[]') as StoredWork[];
      const publishedWorks: Work[] = stored
        .filter((work) => work.status === 'published')
        .map((work) => ({
          id: work.id,
          title: work.title,
          author: '我',
          time: '刚刚',
          style: `${MOOD_LABELS[work.mood] ?? '原创'} · ${GENRE_LABELS[work.genre] ?? '音乐'}`,
          stars: 0,
          starred: false,
          audio: work.audio,
          caption: work.caption,
          emoji: work.emoji,
          instruments: work.instruments,
        }));
      setWorks([...publishedWorks, ...DEMO_WORKS]);
    } catch {
      setWorks(DEMO_WORKS);
    }

    return () => audioRef.current?.pause();
  }, []);

  const handleStar = (id: number) => {
    setWorks((prev) =>
      prev.map((w) =>
        w.id === id ? { ...w, starred: !w.starred, stars: w.starred ? w.stars - 1 : w.stars + 1 } : w
      )
    );
  };

  const togglePlay = (work: Work) => {
    if (!work.audio) return;
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
        <h1 className="text-xl font-bold text-gray-800 text-center">🌟 社区</h1>
      </div>

      <div className="p-4 space-y-3">
        {works.map((work) => (
          <motion.div
            key={work.id}
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

            {work.caption && (
              <p className="mb-3 rounded-xl bg-orange-50 px-3 py-2 text-sm text-gray-600">{work.caption}</p>
            )}

            <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center gap-3 mb-3">
              <button
                type="button"
                onClick={() => togglePlay(work)}
                disabled={!work.audio}
                aria-label={playingId === work.id ? `暂停${work.title}` : `播放${work.title}`}
                className="w-8 h-8 rounded-full bg-[#FF9F43] text-white flex items-center justify-center text-sm disabled:opacity-70"
              >
                {playingId === work.id ? 'Ⅱ' : '▶'}
              </button>
              <div className="flex-1 h-1.5 bg-gray-200 rounded-full">
                <div className={`h-full bg-[#FF9F43] rounded-full transition-all ${playingId === work.id ? 'w-2/3' : 'w-1/3'}`} />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full">{work.style}</span>
                {work.instruments && work.instruments.length > 0 && (
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
                onClick={() => handleStar(work.id)}
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
