'use client';

import { useState } from 'react';
import { playRhythm, playTone } from './games/audio';

// A generic, data-driven "teaching aid": a row of clickable cards, each of
// which plays a sound (single tone or rhythm) and flashes on tap. Every level
// gets one via components/academy/teachingAids.ts. Deliberately plain — no
// per-aid animation, per the demo-phase decision to keep frontend work lean.

export interface TeachingAidItem {
  emoji: string;
  label: string;
  freq?: number;
  /** Seconds. */
  duration?: number;
  volume?: number;
  /** Beat-length sequence, e.g. [1, 1] plays two quarter notes. */
  beats?: number[];
}

interface TeachingAidProps {
  items: TeachingAidItem[];
  caption: string;
  /** When true, render one big centred button instead of a grid. */
  single?: boolean;
}

export function TeachingAid({ items, caption, single = false }: TeachingAidProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const play = (item: TeachingAidItem, index: number) => {
    if (item.beats) {
      void playRhythm(item.beats);
    } else if (item.freq) {
      playTone(item.freq, item.duration ?? 0.5, item.volume ?? 0.28);
    }
    setActiveIndex(index);
    window.setTimeout(() => setActiveIndex(null), 350);
  };

  if (single) {
    const item = items[0];
    return (
      <div className="mt-3 text-center">
        <button
          type="button"
          onClick={() => play(item, 0)}
          className={`mx-auto grid h-20 w-20 place-items-center rounded-2xl border-2 text-4xl shadow-sm transition-transform ${
            activeIndex === 0 ? 'scale-110 border-orange-300 bg-orange-50' : 'border-white/80 bg-white/80'
          }`}
          aria-label={item.label}
        >
          {item.emoji}
        </button>
        <p className="mt-1.5 text-[11px] font-bold text-slate-500">{item.label}</p>
        <p className="mt-1 text-[11px] leading-4 text-slate-400">{caption}</p>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-white/80 bg-white/80 p-3 sm:mt-4 sm:p-3.5">
      <p className="text-[11px] font-black tracking-wider text-green-600">🎹 先来听听</p>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {items.map((item, index) => (
          <button
            key={item.label}
            type="button"
            onClick={() => play(item, index)}
            className={`rounded-xl border-2 py-2 text-center transition-transform ${
              activeIndex === index
                ? 'scale-110 border-orange-300 bg-orange-50'
                : 'border-white bg-white/90'
            }`}
            aria-label={`听${item.label}`}
          >
            <span className="block text-xl">{item.emoji}</span>
            <span className="mt-0.5 block text-[10px] font-bold text-slate-600">{item.label}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-4 text-slate-500">{caption}</p>
    </div>
  );
}
