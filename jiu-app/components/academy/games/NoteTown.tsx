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
import { NOTES, playTone } from './audio';

const TOWN_NOTES = [
  ...NOTES,
  { name: 'Fa', shortName: 'F', freq: 349.23, color: '#4ca7e8' },
  { name: 'Sol', shortName: 'G', freq: 392, color: '#7d74db' },
  { name: 'La', shortName: 'A', freq: 440, color: '#b46bd4' },
  { name: 'Si', shortName: 'B', freq: 493.88, color: '#e56b9f' },
] as const;

type TownNote = (typeof TOWN_NOTES)[number];
type Feedback = 'correct' | 'wrong' | null;

const NOTE_DETAILS = {
  Do: { character: '稳稳的', height: '低音小屋', roof: '#ef6a4d' },
  Re: { character: '亮亮的', height: '山脚小屋', roof: '#e8aa21' },
  Mi: { character: '轻快的', height: '林间小屋', roof: '#35a86d' },
  Fa: { character: '清新的', height: '花园小屋', roof: '#4ca7e8' },
  Sol: { character: '闪闪的', height: '树梢小屋', roof: '#7d74db' },
  La: { character: '柔柔的', height: '云端小屋', roof: '#b46bd4' },
  Si: { character: '亮晶晶', height: '星光小屋', roof: '#e56b9f' },
} as const;

function createRounds() {
  const rounds = [...TOWN_NOTES];
  for (let index = rounds.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [rounds[index], rounds[target]] = [rounds[target], rounds[index]];
  }
  return rounds;
}

export function NoteTown({
  onComplete,
  onMistake,
  simpleMode,
}: AcademyGameProps) {
  const [rounds] = useState<TownNote[]>(createRounds);
  const [round, setRound] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [answered, setAnswered] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const playbackTimerRef = useRef<number | null>(null);
  const transitionTimerRef = useRef<number | null>(null);
  const target = rounds[round];

  const playCurrent = useCallback(() => {
    if (answered) return;
    if (playbackTimerRef.current) {
      window.clearTimeout(playbackTimerRef.current);
    }
    setIsPlaying(true);
    playTone(target.freq, 0.75, 0.5);
    playbackTimerRef.current = window.setTimeout(() => {
      setIsPlaying(false);
      playbackTimerRef.current = null;
    }, 850);
  }, [answered, target.freq]);

  useEffect(() => {
    const readyTimer = window.setTimeout(playCurrent, 420);
    return () => {
      window.clearTimeout(readyTimer);
      if (playbackTimerRef.current) {
        window.clearTimeout(playbackTimerRef.current);
      }
    };
  }, [playCurrent]);

  useEffect(
    () => () => {
      if (transitionTimerRef.current) {
        window.clearTimeout(transitionTimerRef.current);
      }
    },
    [],
  );

  const chooseHouse = (choice: TownNote) => {
    if (answered || isPlaying) return;
    const isCorrect = choice.name === target.name;
    setSelected(choice.name);
    setAnswered(true);
    setFeedback(isCorrect ? 'correct' : 'wrong');

    if (!isCorrect) {
      setMistakes((value) => value + 1);
      onMistake();
      transitionTimerRef.current = window.setTimeout(() => {
        setSelected(null);
        setFeedback(null);
        setAnswered(false);
        transitionTimerRef.current = null;
      }, 760);
      return;
    }

    const nextCorrect = correct + 1;
    setCorrect(nextCorrect);
    playTone(target.freq, 0.45, 0.4);
    transitionTimerRef.current = window.setTimeout(() => {
      if (round >= rounds.length - 1) {
        onComplete(mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1);
      } else {
        setRound((value) => value + 1);
        setSelected(null);
        setFeedback(null);
        setAnswered(false);
      }
      transitionTimerRef.current = null;
    }, 820);
  };

  return (
    <div className="flex h-full min-h-0 flex-col items-center gap-2 overflow-hidden sm:gap-3">
      <GameIntro detail="听标准音，找到对应的小屋">
        🎵 欢迎来到音符小镇
      </GameIntro>
      <SimpleModeNotice show={simpleMode} />
      <RoundProgress current={round} total={rounds.length} label="拜访进度" />

      <div className="w-full max-w-sm overflow-hidden rounded-[1.5rem] border border-emerald-100 bg-gradient-to-b from-sky-50 via-white to-emerald-50 shadow-inner sm:rounded-[1.75rem]">
        <div className="flex items-center justify-between px-3 pt-2.5 sm:px-4 sm:pt-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">
              山林音符小镇
            </p>
            <p className="mt-0.5 text-xs font-black text-slate-700 sm:text-sm">
              谁在小镇里唱歌？
            </p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
              isPlaying
                ? 'bg-sky-100 text-sky-600'
                : answered
                  ? 'bg-green-100 text-green-600'
                  : 'bg-slate-100 text-slate-500'
            }`}
            aria-live="polite"
          >
            {isPlaying ? '仔细听…' : answered ? '正在揭晓' : '等待选择'}
          </span>
        </div>

        <div className="relative mx-3 mt-2 h-40 overflow-hidden rounded-2xl border border-white/90 bg-gradient-to-b from-[#bfe7ff] via-[#eaf8ff] to-[#d9f3cd] sm:mx-4 sm:h-44">
          <span className="absolute right-4 top-3 h-7 w-7 rounded-full bg-[#ffe28b] shadow-[0_0_18px_rgba(255,226,139,0.8)]" aria-hidden="true" />
          <span className="absolute left-4 top-5 h-2 w-10 rounded-full bg-white/75 shadow-[8px_3px_0_rgba(255,255,255,0.75)]" aria-hidden="true" />
          <div className="absolute inset-x-0 bottom-0 h-14 rounded-t-[50%] bg-emerald-200/75" />
          <div className="absolute -bottom-8 -left-7 h-24 w-32 rounded-[50%] bg-green-300/70" />
          <div className="absolute -bottom-9 -right-8 h-28 w-36 rounded-[50%] bg-emerald-300/70" />
          <div className="absolute inset-x-0 bottom-3 h-3 bg-[#f8dcb0]/80 [clip-path:polygon(0_58%,20%_0,48%_65%,70%_5%,100%_55%,100%_100%,0_100%)]" />

          {!answered && (
            <motion.div
              animate={
                isPlaying
                  ? { y: [0, -4, 0], rotate: [-3, 3, -3] }
                  : { y: 0, rotate: 0 }
              }
              transition={{ duration: 0.55, repeat: isPlaying ? Infinity : 0 }}
              className="absolute left-1/2 top-5 z-20 -translate-x-1/2 text-3xl"
              aria-hidden="true"
            >
              🐦
            </motion.div>
          )}
          {isPlaying && (
            <div className="absolute left-1/2 top-6 z-10 ml-5 flex items-end gap-0.5">
              {[8, 15, 11].map((height, index) => (
                <motion.span
                  key={height}
                  className="w-1 rounded-full bg-sky-500"
                  animate={{ height: [5, height, 5] }}
                  transition={{
                    duration: 0.38,
                    delay: index * 0.08,
                    repeat: Infinity,
                  }}
                />
              ))}
            </div>
          )}

          <div className="absolute inset-x-2 bottom-5 z-20 grid grid-cols-7 items-end gap-1">
            {TOWN_NOTES.map((note, index) => {
              const detail = NOTE_DETAILS[note.name];
              const isCorrectHouse = note.name === target.name;
              const isSelected = selected === note.name;
              const resultClass = answered
                ? isCorrectHouse
                  ? 'ring-2 ring-green-300'
                  : isSelected
                    ? 'ring-2 ring-red-300'
                    : 'opacity-60'
                : 'hover:-translate-y-1';

              return (
                <motion.button
                  key={note.name}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => chooseHouse(note)}
                  disabled={answered || isPlaying}
                  aria-label={`${note.name} ${detail.height}`}
                  className={`relative min-w-0 overflow-visible rounded-t-[0.7rem] border-2 border-[#fffdf7] bg-[#fffaf0] text-center shadow-[0_3px_0_rgba(76,89,110,0.14),0_7px_12px_rgba(76,89,110,0.12)] transition ${resultClass}`}
                  style={{
                    color: note.color,
                    height: `${43 + index * 3}px`,
                  }}
                >
                  <span
                    className="absolute inset-x-0.5 -top-2 h-5 rounded-t-[0.75rem] shadow-sm [clip-path:polygon(50%_0,100%_100%,0_100%)]"
                    style={{ backgroundColor: detail.roof }}
                    aria-hidden="true"
                  />
                  {index % 2 === 0 && (
                    <span className="absolute -top-3 right-1 h-3 w-1.5 rounded-t-sm bg-[#a8795b]" aria-hidden="true" />
                  )}
                  <span
                    className={`absolute left-1.5 top-2.5 h-2 w-2 rounded-sm border border-white/80 ${
                      answered && isCorrectHouse ? 'bg-[#ffe58f] shadow-[0_0_8px_#ffe58f]' : 'bg-[#bde9f5]'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="absolute right-1.5 top-2.5 h-2 w-2 rounded-sm border border-white/80 bg-[#bde9f5]" aria-hidden="true" />
                  <span className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-[10px] font-black leading-none">
                    {note.name}
                  </span>
                  <span
                    className="absolute bottom-0 left-1/2 h-3 w-2.5 -translate-x-1/2 rounded-t-sm bg-[#b98765]"
                    aria-hidden="true"
                  />
                  {answered && isCorrectHouse && (
                    <motion.span
                      initial={{ y: -8, opacity: 0, scale: 0.7 }}
                      animate={{ y: 0, opacity: 1, scale: 1 }}
                      className="absolute -top-8 left-1/2 z-30 -translate-x-1/2 text-xl"
                      aria-label="小鸟找到小屋"
                    >
                      🐦
                    </motion.span>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="px-3 pb-2.5 pt-2 sm:px-4 sm:pb-3">
          <button
            onClick={playCurrent}
            disabled={isPlaying || answered}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-sky-100 bg-white py-2.5 text-xs font-black text-sky-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
          >
            {isPlaying ? '🔊 小鸟正在唱…' : '▶️ 再听一次'}
          </button>

          <p className="mt-2 text-center text-[10px] font-bold text-slate-500">
            音高由低到高：Do → Re → Mi → Fa → Sol → La → Si
          </p>
        </div>
      </div>

      <AnswerFeedback type={feedback}>
        {feedback === 'correct'
          ? `${target.name} 找到自己的小屋啦！`
          : '再听一次：Do、Re、Mi、Fa、Sol、La、Si 的音高会一步步升高。'}
      </AnswerFeedback>

      <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
        已找到 {correct} 位音符居民
      </div>
    </div>
  );
}
