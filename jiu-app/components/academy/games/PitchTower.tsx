'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AcademyGameProps } from './types';
import {
  AnswerFeedback,
  GameIntro,
  RoundProgress,
  SimpleModeNotice,
} from './GameUI';
import { detectPitch, hzToNote, NOTES, playTone } from './audio';

type PitchStatus =
  | 'ready'
  | 'listening'
  | 'correct'
  | 'low'
  | 'high'
  | 'unclear'
  | 'fallback';

const PITCH_NOTES = [
  ...NOTES,
  { name: 'Fa', shortName: 'F', freq: 349.23, color: '#4ca7e8' },
  { name: 'Sol', shortName: 'G', freq: 392, color: '#7d74db' },
  { name: 'La', shortName: 'A', freq: 440, color: '#b46bd4' },
  { name: 'Si', shortName: 'B', freq: 493.88, color: '#e56b9f' },
] as const;

const FLOOR_DETAILS = [
  { label: '森林层', note: PITCH_NOTES[0] },
  { label: '云朵层', note: PITCH_NOTES[1] },
  { label: '星光层', note: PITCH_NOTES[2] },
  { label: '彩虹层', note: PITCH_NOTES[3] },
  { label: '微风层', note: PITCH_NOTES[4] },
  { label: '月光层', note: PITCH_NOTES[5] },
  { label: '云顶层', note: PITCH_NOTES[6] },
] as const;

const FLOOR_SLOT_HEIGHT = 45;

// PRD 学院 v3 的判定标准是 Hz 制:Do–Sol ±30Hz,La ±40Hz,Si ±45Hz。
// 儿童唱高音偏差较大,La/Si 按文档适度放宽。
const TOLERANCE_HZ: Record<string, number> = {
  Do: 30,
  Re: 30,
  Mi: 30,
  Fa: 30,
  Sol: 30,
  La: 40,
  Si: 45,
};

export function PitchTower({
  onComplete,
  onMistake,
  simpleMode,
}: AcademyGameProps) {
  const [floor, setFloor] = useState(0);
  const [climbed, setClimbed] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [status, setStatus] = useState<PitchStatus>('ready');
  const [detected, setDetected] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isWindowSliding, setIsWindowSliding] = useState(false);
  const [isWindowResetting, setIsWindowResetting] = useState(false);
  const playbackTimerRef = useRef<number | null>(null);
  const transitionTimerRef = useRef<number | null>(null);
  const currentFloor = FLOOR_DETAILS[Math.min(floor, FLOOR_DETAILS.length - 1)];
  const target = currentFloor.note;
  const visibleFloorStart = Math.min(
    Math.max(floor - 1, 0),
    FLOOR_DETAILS.length - 3,
  );
  const floorTrack = FLOOR_DETAILS.slice(visibleFloorStart, visibleFloorStart + 4);
  const feedback =
    status === 'correct'
      ? 'correct'
      : status === 'low' || status === 'high' || status === 'unclear'
        ? 'wrong'
        : null;

  const playTarget = useCallback(() => {
    if (status === 'listening' || status === 'correct') return;
    if (playbackTimerRef.current) {
      window.clearTimeout(playbackTimerRef.current);
    }
    setIsPlaying(true);
    playTone(target.freq, 0.8, 0.25);
    playbackTimerRef.current = window.setTimeout(() => {
      setIsPlaying(false);
      playbackTimerRef.current = null;
    }, 900);
  }, [status, target.freq]);

  useEffect(() => {
    const readyTimer = window.setTimeout(playTarget, 420);
    return () => {
      window.clearTimeout(readyTimer);
      if (playbackTimerRef.current) {
        window.clearTimeout(playbackTimerRef.current);
      }
    };
  }, [playTarget]);

  useEffect(
    () => () => {
      if (transitionTimerRef.current) {
        window.clearTimeout(transitionTimerRef.current);
      }
    },
    [],
  );

  const finishFloor = (fallbackMode = false) => {
    if (transitionTimerRef.current) return;
    const nextFloor = floor + 1;
    const shouldSlideWindow = floor >= 1 && floor <= FLOOR_DETAILS.length - 3;
    if (shouldSlideWindow) {
      setIsWindowResetting(false);
      setIsWindowSliding(true);
    }
    setClimbed(nextFloor);
    transitionTimerRef.current = window.setTimeout(() => {
      if (nextFloor >= FLOOR_DETAILS.length) {
        onComplete(fallbackMode ? 1 : mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1);
      } else {
        setFloor(nextFloor);
        if (shouldSlideWindow) {
          // The floor window changes at the same instant its track returns to
          // rest, so the three cards keep their visual positions.
          setIsWindowResetting(true);
          setIsWindowSliding(false);
        }
        setStatus(fallbackMode ? 'fallback' : 'ready');
        setDetected(null);
      }
      transitionTimerRef.current = null;
    }, 620);
  };

  const listen = async () => {
    if (isPlaying || status === 'listening' || status === 'correct') return;
    setStatus('listening');
    setDetected(null);

    try {
      const hz = await detectPitch(simpleMode ? 1000 : 1350);
      if (!hz) {
        setStatus('unclear');
        setDetected('没有听清，请靠近麦克风再唱一次');
        setMistakes((value) => value + 1);
        onMistake();
        return;
      }

      const difference = 12 * Math.log2(hz / target.freq);
      setDetected(`${hzToNote(hz)} · ${Math.round(hz)} Hz`);
      const toleranceHz = TOLERANCE_HZ[target.name] ?? 30;
      // 简单模式再放宽一档(×1.8),让答错较多的孩子更容易唱准。
      if (Math.abs(hz - target.freq) <= (simpleMode ? toleranceHz * 1.8 : toleranceHz)) {
        setStatus('correct');
        playTone(target.freq, 0.4, 0.18);
        finishFloor();
        return;
      }

      setStatus(difference < 0 ? 'low' : 'high');
      setMistakes((value) => value + 1);
      onMistake();
    } catch {
      setStatus('fallback');
      setDetected('麦克风不可用，已切换为自主跟唱模式');
    }
  };

  const message =
    status === 'listening'
      ? '保持声音，正在判断音高…'
      : status === 'correct'
        ? `唱准 ${target.name}，小鸟向上攀登！`
        : status === 'low'
          ? '音高有一点低，再唱高一些'
          : status === 'high'
            ? '音高有一点高，再唱低一些'
            : status === 'unclear'
              ? '没有听清，放慢速度再试一次'
              : status === 'fallback'
                ? '听标准音后认真跟唱，再继续攀登'
                : `先听 ${target.name}，再唱出同样的高度`;

  return (
    <div className="flex flex-col items-center gap-2.5 sm:gap-4">
      <GameIntro detail="先听标准音，再唱出相同音高，帮助小鸟登上七层高塔">
        🗼 云端音准塔开放
      </GameIntro>
      <SimpleModeNotice show={simpleMode} />
      <RoundProgress current={floor} total={FLOOR_DETAILS.length} label="攀登进度" />

      <div className="w-full max-w-sm overflow-hidden rounded-[1.5rem] border border-violet-100 bg-gradient-to-b from-indigo-50 via-white to-violet-50 shadow-inner sm:rounded-[1.75rem]">
        <div className="flex items-center justify-between px-3 pt-3 sm:px-4 sm:pt-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-600">
              云端音准塔
            </p>
            <p className="mt-0.5 text-xs font-black text-slate-700 sm:text-sm">
              第 {Math.min(floor + 1, FLOOR_DETAILS.length)} 层 · {currentFloor.label}
            </p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
              status === 'listening'
                ? 'bg-red-100 text-red-600'
                : status === 'correct'
                  ? 'bg-green-100 text-green-600'
                  : status === 'fallback'
                    ? 'bg-amber-100 text-amber-600'
                    : 'bg-violet-100 text-violet-600'
            }`}
            aria-live="polite"
          >
            {status === 'listening'
              ? '正在听你唱'
              : status === 'correct'
                ? '成功攀登'
                : status === 'fallback'
                  ? '跟唱模式'
                  : `目标 ${target.name}`}
          </span>
        </div>

        <div className="relative mx-3 mt-2.5 h-44 overflow-hidden rounded-2xl border border-white/90 bg-gradient-to-b from-indigo-100 via-sky-100 to-violet-100 sm:mx-4 sm:h-48">
          <span className="absolute left-4 top-4 text-xl opacity-80" aria-hidden="true">
            ☁️
          </span>
          <span className="absolute right-5 top-9 text-lg opacity-70" aria-hidden="true">
            ☁️
          </span>
          <span className="absolute right-4 top-2 text-2xl" aria-hidden="true">
            ⭐
          </span>

          <div className="absolute bottom-0 left-1/2 h-40 w-36 -translate-x-1/2 overflow-hidden rounded-t-[3.5rem] border-[5px] border-violet-200 bg-white/65 shadow-lg">
            <motion.div
              className="absolute inset-0"
              initial={false}
              animate={{ y: isWindowSliding ? FLOOR_SLOT_HEIGHT : 0 }}
              transition={{
                y: isWindowResetting
                  ? { duration: 0 }
                  : { duration: 0.52, ease: 'easeInOut' },
              }}
            >
            {floorTrack.map((item, trackIndex) => {
              const visibleIndex = trackIndex;
              const index = visibleFloorStart + visibleIndex;
              const reached = climbed > index;
              const active = floor === index && climbed === floor;
              const justCompleted = status === 'correct' && floor === index;
              return (
                <motion.div
                  key={item.note.name}
                  initial={false}
                  animate={{
                    scale: justCompleted ? [1, 1.08, 1] : active ? 1.03 : 1,
                  }}
                  transition={{
                    scale: { duration: justCompleted ? 0.42 : 0.2 },
                  }}
                  className={`absolute left-3 right-3 flex h-7 items-center justify-between rounded-lg border-2 px-2 text-[9px] font-black transition ${
                    reached
                      ? 'border-green-300 bg-green-50 text-green-600'
                      : active
                        ? 'border-violet-300 bg-violet-50 text-violet-600 shadow-[0_0_12px_rgba(139,92,246,0.25)]'
                        : 'border-white bg-white/75 text-slate-400'
                  }`}
                  style={{ bottom: `${12 + visibleIndex * 28}%` }}
                >
                  <span>{index + 1}F</span>
                  <span style={{ color: item.note.color }}>
                    {reached ? '✓' : item.note.name}
                  </span>
                  {index === floor && (
                    <motion.span
                      className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 text-base leading-none"
                      initial={false}
                      animate={{
                        scale: status === 'correct' ? [1, 1.28, 1] : 1,
                        y: status === 'correct' ? [0, -4, 0] : 0,
                      }}
                      transition={{ duration: 0.38, ease: 'easeOut' }}
                      aria-hidden="true"
                    >
                      🐦
                    </motion.span>
                  )}
                </motion.div>
              );
            })}
            </motion.div>
          </div>

          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <motion.div
              animate={isPlaying ? { scale: [1, 1.08, 1] } : { scale: 1 }}
              transition={{ duration: 0.5, repeat: isPlaying ? Infinity : 0 }}
              className="grid h-14 w-14 place-items-center rounded-2xl border-2 border-white bg-white/85 shadow-md"
              style={{ color: target.color }}
            >
              <span className="text-center">
                <strong className="block text-lg leading-none">{target.name}</strong>
                <span className="mt-1 block text-[8px] font-bold text-slate-400">
                  {Math.round(target.freq)} Hz
                </span>
              </span>
            </motion.div>
          </div>
        </div>

        <div className="px-3 pb-3 pt-2.5 sm:px-4 sm:pb-4">
          <p
            className={`min-h-4 text-center text-[10px] font-bold ${
              status === 'low' || status === 'high' || status === 'unclear'
                ? 'text-red-500'
                : status === 'correct'
                  ? 'text-green-600'
                  : 'text-slate-500'
            }`}
          >
            {message}
          </p>
          {detected && (
            <p className="mt-1 text-center text-[9px] font-bold text-slate-400">
              检测结果：{detected}
            </p>
          )}

          <div className="mt-2 grid grid-cols-[0.8fr_1.2fr] gap-2">
            <button
              onClick={playTarget}
              disabled={isPlaying || status === 'listening' || status === 'correct'}
              className="rounded-xl border border-violet-100 bg-white px-2 py-2.5 text-xs font-black text-violet-600 shadow-sm transition hover:border-violet-300 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPlaying ? '🔊 播放中…' : `▶ 听 ${target.name}`}
            </button>

            {status === 'fallback' ? (
              <button
                onClick={() => finishFloor(true)}
                className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-2 py-2.5 text-xs font-black text-white shadow-md"
              >
                ✓ 已认真跟唱，向上
              </button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => void listen()}
                disabled={isPlaying || status === 'listening' || status === 'correct'}
                className={`rounded-xl px-2 py-2.5 text-xs font-black text-white shadow-md transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  status === 'listening'
                    ? 'bg-red-400'
                    : 'bg-gradient-to-r from-violet-500 to-indigo-500'
                }`}
              >
                {status === 'listening' ? '🎤 保持演唱…' : '🎤 开始跟唱'}
              </motion.button>
            )}
          </div>
        </div>
      </div>

      <AnswerFeedback type={feedback}>
        {status === 'correct'
          ? `${target.name} 唱准啦，成功上升一层！`
          : status === 'low'
            ? '这次稍微偏低，跟着标准音唱高一点。'
            : status === 'high'
              ? '这次稍微偏高，跟着标准音唱低一点。'
              : '没有听清，靠近麦克风并把声音唱长一些。'}
      </AnswerFeedback>

      <div className="grid w-full max-w-sm grid-cols-7 gap-1 text-center text-[9px] font-bold text-slate-500 sm:text-[10px]">
        {FLOOR_DETAILS.map((item, index) => (
          <div key={item.note.name}>
            <span
              className={`block rounded-full px-1 py-1 ${
                climbed > index
                  ? 'bg-green-50 text-green-600'
                  : floor === index
                    ? 'bg-violet-100 text-violet-600'
                    : 'bg-slate-100 text-slate-400'
              }`}
            >
              {item.note.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
