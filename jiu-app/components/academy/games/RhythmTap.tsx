'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AcademyGameProps } from './types';
import { GameIntro, RoundProgress, SimpleModeNotice, AnswerFeedback } from './GameUI';
import { playRhythm, playTone } from './audio';
import { animalForBeats, BEAT_MS, cumulativeStarts, sumBeats } from './rhythm';

// 2-2 节奏拍拍乐:固定节拍 + 目标节奏序列,跟拍点鼓复刻
//   每组先听示范,然后"开始跟拍",在匀速节拍里敲出目标节奏
//   大体匹配即通过,共 3 组

type Phase = 'intro' | 'playing' | 'judge';

const TAP_PATTERNS: number[][] = [
  [1, 1, 1, 1],
  [1, 0.5, 0.5, 1, 1],
  [1, 1, 0.5, 0.5, 1],
];

export function RhythmTap({ onComplete, onMistake, simpleMode }: AcademyGameProps) {
  const patterns = simpleMode ? TAP_PATTERNS.slice(0, 2) : TAP_PATTERNS;
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<Phase>('intro');
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [taps, setTaps] = useState(0);
  const [beatCount, setBeatCount] = useState(0);
  const wrongRoundsRef = useRef(0);

  const target = patterns[round];
  const totalMs = useMemo(() => sumBeats(target) * BEAT_MS, [target]);
  const expectedStarts = useMemo(() => cumulativeStarts(target), [target]);
  const windowStartRef = useRef(0);
  const tapsRef = useRef<number[]>([]);
  const metronomeRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (metronomeRef.current) window.clearInterval(metronomeRef.current);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const playDemo = () => {
    void playRhythm(target);
  };

  const startRound = () => {
    windowStartRef.current = performance.now();
    tapsRef.current = [];
    setTaps(0);
    setBeatCount(0);
    setPhase('playing');
    playDemo();

    // 匀速节拍:全程敲底鼓,用户跟着点鼓复刻节奏
    let tick = 0;
    metronomeRef.current = window.setInterval(() => {
      tick += 1;
      setBeatCount(tick);
      playTone(170, 0.07, 0.2);
      if (tick >= Math.ceil(sumBeats(target))) {
        if (metronomeRef.current) window.clearInterval(metronomeRef.current);
        window.setTimeout(() => judge(), 260);
      }
    }, BEAT_MS);
  };

  const handleTap = () => {
    if (phase !== 'playing') return;
    const now = performance.now() - windowStartRef.current;
    tapsRef.current.push(now);
    setTaps(tapsRef.current.length);
    playTone(420, 0.06, 0.3);
  };

  const judge = () => {
    // 把每次敲击匹配到最近的音符起点;大体匹配(≥60%)即通过
    const tapTimes = [...tapsRef.current].sort((a, b) => a - b);
    const tolerance = simpleMode ? 300 : 210;
    let matched = 0;
    for (const expected of expectedStarts) {
      let best = -1;
      let bestDiff = Infinity;
      tapTimes.forEach((t, index) => {
        const diff = Math.abs(t - expected);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = index;
        }
      });
      if (best >= 0 && bestDiff <= tolerance) {
        matched += 1;
        tapTimes.splice(best, 1);
      }
    }

    const pass = matched / expectedStarts.length >= 0.6;
    setPhase('judge');
    if (!pass) {
      wrongRoundsRef.current += 1;
      onMistake();
    }
    setFeedback(pass ? 'correct' : 'wrong');

    timerRef.current = window.setTimeout(() => {
      setFeedback(null);
      if (pass) {
        if (round >= patterns.length - 1) {
          onComplete(wrongRoundsRef.current === 0 ? 3 : 2);
        } else {
          setRound((value) => value + 1);
          setPhase('intro');
        }
      } else {
        setPhase('intro');
      }
    }, 1000);
  };

  return (
    <div className="flex flex-col items-center gap-2.5 sm:gap-4">
      <GameIntro detail="先听示范，再跟着节拍点鼓，把节奏敲出来">
        🥁 节奏拍拍乐
      </GameIntro>
      <SimpleModeNotice show={simpleMode} />
      <RoundProgress current={round} total={patterns.length} label="跟拍进度" />

      <div className="w-full max-w-sm rounded-[1.5rem] border border-orange-100 bg-gradient-to-b from-orange-50 via-white to-red-50 p-3 shadow-inner sm:p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-500">节奏跑道</p>
            <p className="mt-0.5 text-xs font-black text-slate-700 sm:text-sm">
              目标是敲出这一段节奏
            </p>
          </div>
          <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[10px] font-black text-orange-600">
            ♩ 节奏 {round + 1}
          </span>
        </div>

        <div className="mt-3 rounded-2xl border border-white/90 bg-white/75 p-3">
          <div className="mb-2 flex items-center justify-between text-[10px] font-black text-slate-400">
            <span>目标节奏</span>
            <button
              type="button"
              onClick={playDemo}
              disabled={phase === 'playing'}
              className="font-black text-orange-500 underline disabled:opacity-50"
            >
              {phase === 'playing' ? '播放中…' : '🔁 听示范'}
            </button>
          </div>
          <div className="flex items-end gap-1">
            {target.map((beats, index) => {
              const animal = animalForBeats(beats);
              return (
                <div key={index} className="flex flex-col items-center" style={{ flex: beats }}>
                  <span className="text-2xl">{animal.emoji}</span>
                  <span className="mt-0.5 text-[9px] font-bold text-slate-400">{animal.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative mt-3 grid place-items-center rounded-[1.5rem] border border-white/90 bg-gradient-to-b from-red-50 to-orange-100/70 py-5">
          <motion.button
            animate={phase === 'playing' && beatCount % 2 === 1 ? { scale: 1.08 } : { scale: 1 }}
            onClick={handleTap}
            disabled={phase !== 'playing'}
            className="grid h-28 w-28 place-items-center rounded-full border-[7px] border-orange-200 bg-gradient-to-b from-orange-300 to-orange-500 text-5xl shadow-xl disabled:opacity-80"
            aria-label="敲鼓"
          >
            🥁
          </motion.button>
          <p className="mt-2 text-center text-[11px] font-black text-slate-500">
            {phase === 'intro'
              ? '点【开始跟拍】后敲鼓'
              : phase === 'playing'
                ? `已敲 ${taps} 下，跟着节拍点！`
                : '判定中…'}
          </p>
        </div>

        <button
          type="button"
          onClick={startRound}
          disabled={phase === 'playing'}
          className="mt-3 w-full rounded-xl bg-orange-500 py-3 text-sm font-black text-white shadow-md disabled:opacity-50"
        >
          {phase === 'playing' ? '跟拍中…' : '🎬 开始跟拍'}
        </button>
      </div>

      <AnswerFeedback type={feedback}>
        {feedback === 'correct' ? '节奏对上了，棒！' : '再听一次示范，跟着节拍慢慢敲'}
      </AnswerFeedback>
    </div>
  );
}
