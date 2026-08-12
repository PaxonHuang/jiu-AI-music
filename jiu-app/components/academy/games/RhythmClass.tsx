'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AcademyGameProps } from './types';
import { GameIntro, SimpleModeNotice, AnswerFeedback } from './GameUI';
import { playRhythm } from './audio';
import { NOTE_ANIMALS, STEADY_BEATS, UNSTEADY_BEATS } from './rhythm';

// 2-1 节奏小课堂:三步教学
//   第一步 认识稳定节拍 —— A 匀速 / B 忽快忽慢,选出稳定的一段
//   第二步 认识四种音符 —— 依次听四种动物音符
//   第三步 听音配对 —— 随机播一个音符,选对动物,连对 3 组通关

type Step = 1 | 2 | 3;
type Feedback = 'correct' | 'wrong' | null;

export function RhythmClass({ onComplete, onMistake, simpleMode }: AcademyGameProps) {
  const [step, setStep] = useState<Step>(1);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [streak, setStreak] = useState(0);
  const [currentBeats, setCurrentBeats] = useState(1);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current); }, []);

  // 进入第三步时系统自动随机播放一个音符
  useEffect(() => {
    if (step !== 3) return;
    const choices = simpleMode ? [1, 0.5] : [2, 1, 0.5, 0.25];
    const next = choices[Math.floor(Math.random() * choices.length)];
    setCurrentBeats(next);
    play([next]);
    // 只在意 step 切换;simpleMode 变化不需要重播
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const play = (beats: number[]) => {
    void playRhythm(beats);
  };

  // 第一步:判断哪段是稳定节拍
  const pickSteady = (isA: boolean) => {
    if (isA) {
      setFeedback('correct');
      timerRef.current = window.setTimeout(() => { setFeedback(null); setStep(2); }, 800);
    } else {
      setFeedback('wrong');
      onMistake();
      timerRef.current = window.setTimeout(() => setFeedback(null), 800);
    }
  };

  // 第三步:开始新一组听音配对
  const startListenRound = () => {
    const choices = simpleMode ? [1, 0.5] : [2, 1, 0.5, 0.25];
    const next = choices[Math.floor(Math.random() * choices.length)];
    setCurrentBeats(next);
    play([next]);
  };

  const answerListen = (beats: number) => {
    if (beats === currentBeats) {
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      setFeedback('correct');
      if (nextStreak >= 3) {
        timerRef.current = window.setTimeout(() => onComplete(3), 900);
        return;
      }
      timerRef.current = window.setTimeout(() => { setFeedback(null); startListenRound(); }, 850);
    } else {
      onMistake();
      setStreak(0);
      setFeedback('wrong');
      // 无惩罚:重新播同一组再试
      timerRef.current = window.setTimeout(() => { setFeedback(null); play([currentBeats]); }, 750);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2.5 sm:gap-4">
      {step === 1 && (
        <>
          <GameIntro detail="听两段鼓点，选出速度一直不变的那一段">
            🎧 第一步：认识稳定节拍
          </GameIntro>
          <SimpleModeNotice show={simpleMode} />
          <div className="w-full max-w-sm rounded-[1.5rem] border border-lime-100 bg-gradient-to-b from-lime-50 via-white to-emerald-50 p-3 shadow-inner sm:p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-lime-600">
              听辨节拍
            </p>
            <p className="mt-1 text-sm font-black text-slate-700">
              哪一段的速度是稳定的？
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => play(STEADY_BEATS)}
                className="rounded-2xl border-2 border-lime-200 bg-white py-6 text-center shadow-sm active:scale-95"
              >
                <span className="block text-3xl">🕐</span>
                <span className="mt-1 block text-sm font-black text-lime-700">A 段 · 先听</span>
              </button>
              <button
                type="button"
                onClick={() => play(UNSTEADY_BEATS)}
                className="rounded-2xl border-2 border-amber-200 bg-white py-6 text-center shadow-sm active:scale-95"
              >
                <span className="block text-3xl">🌀</span>
                <span className="mt-1 block text-sm font-black text-amber-700">B 段 · 先听</span>
              </button>
            </div>
            <p className="mt-3 text-center text-xs font-bold text-slate-500">先点开听，再选：哪段是稳定的节拍？</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => pickSteady(true)}
                className="rounded-xl bg-lime-500 py-2.5 text-sm font-black text-white shadow-md"
              >
                A 段稳定
              </button>
              <button
                type="button"
                onClick={() => pickSteady(false)}
                className="rounded-xl bg-amber-500 py-2.5 text-sm font-black text-white shadow-md"
              >
                B 段稳定
              </button>
            </div>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <GameIntro detail="四种动物代表四种音符，点点它们听听快慢">
            🎧 第二步：认识四种音符
          </GameIntro>
          <div className="w-full max-w-sm rounded-[1.5rem] border border-sky-100 bg-gradient-to-b from-sky-50 via-white to-cyan-50 p-3 shadow-inner sm:p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-600">音符小课堂</p>
            <p className="mt-1 text-sm font-black text-slate-700">点每个小动物，听听它代表多长的音</p>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {NOTE_ANIMALS.map((animal) => (
                <button
                  key={animal.key}
                  type="button"
                  onClick={() => play([animal.beats])}
                  className="rounded-2xl border-2 border-sky-100 bg-white py-4 text-center shadow-sm active:scale-95"
                >
                  <span className="block text-3xl">{animal.emoji}</span>
                  <span className="mt-1 block text-[11px] font-black text-slate-600">{animal.label}</span>
                  <span className="block text-[10px] font-bold text-sky-500">
                    {animal.beats === 2 ? '2拍' : animal.beats === 1 ? '1拍' : animal.beats === 0.5 ? '半拍' : '¼拍'}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => { NOTE_ANIMALS.forEach((a) => void play([a.beats])); }}
              className="mt-3 w-full rounded-xl bg-sky-100 py-2.5 text-xs font-black text-sky-700"
            >
              🔁 从慢到快听一遍
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="mt-2 w-full rounded-xl bg-sky-500 py-2.5 text-sm font-black text-white shadow-md"
            >
              我记住啦，开始挑战 →
            </button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <GameIntro detail={`连对 3 组就过关，听不清可以再听`}>
            🎧 第三步：听音配对（已连对 {streak} / 3）
          </GameIntro>
          <SimpleModeNotice show={simpleMode} />
          <div className="w-full max-w-sm rounded-[1.5rem] border border-orange-100 bg-gradient-to-b from-orange-50 via-white to-yellow-50 p-3 shadow-inner sm:p-4">
            <p className="text-center text-sm font-black text-slate-700">
              刚才响的是哪个小动物？
            </p>
            <div className="mt-3">
              <button
                type="button"
                onClick={() => play([currentBeats])}
                className="w-full rounded-xl bg-orange-100 py-2.5 text-xs font-black text-orange-700"
              >
                🔁 再听一次
              </button>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {NOTE_ANIMALS.map((animal) => (
                <button
                  key={animal.key}
                  type="button"
                  onClick={() => answerListen(animal.beats)}
                  className="rounded-2xl border-2 border-white bg-white py-4 text-center shadow-sm active:scale-95"
                >
                  <span className="block text-3xl">{animal.emoji}</span>
                  <span className="mt-1 block text-[10px] font-black text-slate-600">{animal.label}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 flex justify-center gap-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < streak ? 'bg-green-500' : 'bg-slate-200'}`} />
              ))}
            </div>
          </div>
        </>
      )}

      <AnswerFeedback type={feedback}>
        {feedback === 'correct' ? '答对啦！' : '再听一次，稳定的是 A 段哦'}
      </AnswerFeedback>
    </div>
  );
}
