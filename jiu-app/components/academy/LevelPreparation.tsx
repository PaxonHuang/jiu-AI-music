'use client';

import { motion } from 'framer-motion';
import { AcademyLevel } from '@/lib/constants';
import { TeachingAid } from '@/components/academy/TeachingAid';
import { TEACHING_AIDS } from '@/components/academy/teachingAids';

interface LevelPreparationProps {
  level: AcademyLevel;
  simpleMode: boolean;
  onStart: () => void;
}

const STAGE_THEME = {
  1: {
    gradient: 'from-sky-100 via-white to-orange-50',
    icon: '👂',
    label: '听觉训练',
    accent: 'bg-orange-500',
  },
  2: {
    gradient: 'from-lime-100 via-white to-amber-50',
    icon: '🥁',
    label: '节奏训练',
    accent: 'bg-green-600',
  },
  3: {
    gradient: 'from-indigo-100 via-white to-purple-50',
    icon: '✨',
    label: '旋律训练',
    accent: 'bg-indigo-600',
  },
} as const;

export function LevelPreparation({
  level,
  simpleMode,
  onStart,
}: LevelPreparationProps) {
  const theme = STAGE_THEME[level.stageId];

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      className={`h-full overflow-hidden rounded-[1.5rem] border border-white/80 bg-gradient-to-b ${theme.gradient} p-4 shadow-xl shadow-slate-200/50 sm:rounded-[2rem] sm:p-5`}
    >
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-slate-500">
          {theme.icon} {theme.label}
        </span>
        {simpleMode && (
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-600">
            简单模式
          </span>
        )}
      </div>

      <div className="mt-4 text-center sm:mt-6">
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 2.2, repeat: Infinity }}
          className="mx-auto grid h-20 w-20 place-items-center rounded-[1.6rem] border-4 border-white bg-white/80 text-4xl shadow-lg sm:h-24 sm:w-24 sm:rounded-[2rem] sm:text-5xl"
        >
          {level.icon}
        </motion.div>
        <p className="mt-3 text-[11px] font-black tracking-[0.16em] text-slate-400 sm:mt-5 sm:text-xs">
          第 {level.stageId} 阶段 · {level.stageId}-{level.lesson}
        </p>
        <h2 className="mt-1 text-xl font-black text-slate-800 sm:text-2xl">{level.name}</h2>
      </div>

      <div className="mt-4 rounded-2xl border border-white/80 bg-white/80 p-3 sm:mt-6 sm:p-4">
        <p className="text-xs font-black tracking-wider text-orange-500">本关训练目标</p>
        <p className="mt-1 text-sm font-bold text-slate-700 sm:text-base">{level.subtitle}</p>
        <div className="mt-2 flex gap-2 border-t border-slate-100 pt-2 sm:mt-3 sm:gap-3 sm:pt-3">
          <span className="text-xl sm:text-2xl" aria-hidden="true">🐦</span>
          <p className="line-clamp-2 text-xs leading-5 text-slate-600 sm:text-sm sm:leading-6">
            {level.companionTip}
          </p>
        </div>
      </div>

      {TEACHING_AIDS[level.game] && (
        <TeachingAid {...TEACHING_AIDS[level.game]} />
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 text-center text-[11px] font-bold text-slate-500 sm:mt-4 sm:gap-3 sm:text-xs">
        <div className="rounded-xl bg-white/70 px-2 py-2">
          <span className="mb-0.5 block text-lg sm:mb-1 sm:text-xl">🎯</span>
          3 次核心练习
        </div>
        <div className="rounded-xl bg-white/70 px-2 py-2">
          <span className="mb-0.5 block text-lg sm:mb-1 sm:text-xl">🎁</span>
          奖励 {level.rewardType}
        </div>
      </div>

      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={onStart}
        className={`mt-3 w-full rounded-2xl ${theme.accent} py-3 text-sm font-black text-white shadow-lg sm:mt-5 sm:py-4 sm:text-base`}
      >
        我准备好了，开始挑战
      </motion.button>
    </motion.section>
  );
}
