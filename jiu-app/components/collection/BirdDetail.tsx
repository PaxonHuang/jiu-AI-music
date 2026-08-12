'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bird } from '@/lib/constants';
import { useGlobalStore } from '@/stores/globalStore';
import { BirdPortrait } from './BirdPortrait';

interface BirdDetailProps {
  bird: Bird;
  onClose: () => void;
}

const FRAGMENT_DESTINATIONS = {
  绒羽: { href: '/academy', label: '去学院练习' },
  怪羽: { href: '/workshop', label: '去完成课程与创作' },
  暗羽: { href: '/community', label: '去挑战与探索' },
} as const;

export function BirdDetail({ bird, onClose }: BirdDetailProps) {
  const {
    unlockedBirds,
    fragments,
    currentBirdId,
    setCurrentBird,
    exchangeBird,
  } = useGlobalStore();
  const [showBirdCallToast, setShowBirdCallToast] = useState(false);
  const isUnlocked = unlockedBirds.includes(bird.id);
  const isCurrent = currentBirdId === bird.id;
  const fragmentCount = bird.fragmentType ? fragments[bird.fragmentType] : 0;
  const canExchange = Boolean(
    !isUnlocked &&
    bird.fragmentType &&
    fragmentCount >= bird.fragmentNeeded,
  );
  const destination = bird.fragmentType
    ? FRAGMENT_DESTINATIONS[bird.fragmentType]
    : null;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const toggleBirdCall = () => {
    // Bird calls are not yet recorded. Per PRD update (2026-08), the button
    // surfaces a placeholder toast instead of attempting playback so users
    // understand the feature is reserved for a future release.
    setShowBirdCallToast(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-[#16202A]/55 px-0 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <motion.section
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[30px] bg-[#FFF9F2] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bird-detail-title"
      >
        <div className="sticky top-0 z-20 flex h-12 items-center justify-center bg-[#FFF9F2]/90 backdrop-blur">
          <div className="h-1.5 w-12 rounded-full bg-[#D8CFC5]" aria-hidden="true" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg font-bold text-[#6F655D] shadow-sm"
            aria-label="关闭详情"
          >
            ×
          </button>
        </div>

        <div className="px-5 pb-8">
          <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#FFF0C8] via-[#FFE9D7] to-[#E4F5E9]">
            <div className="absolute -left-5 top-5 h-20 w-20 rounded-full bg-white/30" />
            <div className="absolute -right-6 bottom-0 h-28 w-28 rounded-full bg-[#77C69A]/15" />
            <BirdPortrait
              bird={bird}
              reveal={isUnlocked ? 1 : 0}
              className="mx-auto aspect-square w-[74%] max-w-[280px]"
            />
          </div>

          <div className="mt-5 text-center">
            <div className="mb-2 flex items-center justify-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                isUnlocked
                  ? 'bg-[#52A879]/12 text-[#3E8B62]'
                  : 'bg-[#FF9F43]/12 text-[#D87419]'
              }`}>
                {isUnlocked ? '已经成为伙伴' : '等待兑换'}
              </span>
              {isCurrent && (
                <span className="rounded-full bg-[#2C3E50] px-2.5 py-1 text-[10px] font-bold text-white">
                  正在陪伴
                </span>
              )}
            </div>
            <h2 id="bird-detail-title" className="text-[28px] font-black tracking-tight text-[#263746]">
              {bird.name}
            </h2>
            <p className="mt-1 text-xs font-medium tracking-wide text-[#8E8175]">
              {bird.englishName}
            </p>
          </div>

          <div className="mt-5 rounded-[22px] bg-white p-4 shadow-[0_10px_30px_rgba(78,58,40,0.07)]">
            <p className="text-[14px] font-medium leading-7 text-[#584B40]">
              “{bird.description}”
            </p>
          </div>

          <button
            type="button"
            onClick={toggleBirdCall}
            disabled={!bird.birdCall}
            className={`mt-4 flex min-h-14 w-full items-center gap-3 rounded-[18px] px-4 text-left transition active:scale-[0.99] ${
              bird.birdCall
                ? 'bg-[#2C3E50] text-white'
                : 'cursor-not-allowed bg-[#EAE4DD] text-[#8B8279]'
            }`}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full text-base bg-white/14">
              🎵
            </span>
            <span className="flex-1">
              <span className="block text-sm font-extrabold">听听它的声音</span>
              <span className="mt-0.5 block text-[11px] text-white/65">{bird.sound}</span>
            </span>
            <span className="rounded-full bg-white/14 px-2 py-0.5 text-[10px] font-black tracking-wide text-white">
              即将上线
            </span>
          </button>

          {showBirdCallToast && (
            <div
              role="status"
              className="fixed inset-x-0 bottom-24 z-[80] mx-auto flex max-w-xs justify-center px-4"
            >
              <div className="rounded-2xl bg-[#2C3E50] px-4 py-3 text-sm font-extrabold text-white shadow-xl">
                伙伴声音马上上线，敬请期待
              </div>
            </div>
          )}

          <div className="mt-6">
            <h3 className="text-base font-black text-[#2C3E50]">认识一下这位朋友</h3>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { mark: '01', title: '长什么样', text: bird.feature, color: 'bg-[#FFF0D6]' },
                { mark: '02', title: '住在哪里', text: bird.habitat, color: 'bg-[#E8F5EC]' },
                { mark: '03', title: '平时做什么', text: bird.habit, color: 'bg-[#EAEAFB]' },
              ].map((item) => (
                <div
                  key={item.title}
                  className={`${item.color} min-h-[156px] rounded-[18px] px-2.5 py-3`}
                >
                  <div className="flex h-full flex-col items-center text-center">
                    <span className="rounded-full bg-white/55 px-2 py-1 text-[9px] font-black tracking-wider text-[#7A6C60]">
                      {item.mark}
                    </span>
                    <h4 className="mt-2 text-[13px] font-extrabold leading-5 text-[#3C4B55]">
                      {item.title}
                    </h4>
                    <p className="mt-2 text-[11px] leading-[1.55] text-[#6F655D]">
                      {item.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {!isUnlocked && bird.fragmentType && destination && (
            <div className="mt-6 rounded-[22px] border border-[#F0D9BF] bg-white p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-extrabold text-[#4D433B]">兑换这位音乐伙伴</span>
                <span className="font-black text-[#D87419]">
                  拥有 {fragmentCount} 枚
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-[16px] bg-[#FFF4E6] px-4 py-3">
                <span className="text-xs font-bold text-[#6F5D4D]">兑换需要</span>
                <strong className="text-base font-black text-[#D87419]">
                  {bird.fragmentNeeded} 枚{bird.fragmentType}
                </strong>
              </div>
              <button
                type="button"
                onClick={() => exchangeBird(bird.id)}
                disabled={!canExchange}
                className={`mt-3 min-h-12 w-full rounded-[16px] px-4 text-sm font-extrabold ${
                  canExchange
                    ? 'bg-[#FF9F43] text-white shadow-[0_8px_20px_rgba(255,159,67,0.25)]'
                    : 'cursor-not-allowed bg-[#E8E3DC] text-[#8A8179]'
                }`}
              >
                {canExchange
                  ? `使用 ${bird.fragmentNeeded} 枚${bird.fragmentType}兑换`
                  : `还差 ${Math.max(bird.fragmentNeeded - fragmentCount, 0)} 枚${bird.fragmentType}`}
              </button>
              {!canExchange && (
                <Link
                  href={destination.href}
                  onClick={onClose}
                  className="mt-2 flex min-h-11 items-center justify-center rounded-[16px] px-4 text-xs font-extrabold text-[#A05C28]"
                >
                  {destination.label} →
                </Link>
              )}
            </div>
          )}

          {isUnlocked && (
            <button
              type="button"
              onClick={() => setCurrentBird(bird.id)}
              disabled={isCurrent}
              className={`mt-6 min-h-14 w-full rounded-[18px] text-base font-black transition active:scale-[0.99] ${
                isCurrent
                  ? 'bg-[#E8E3DC] text-[#82786F]'
                  : 'bg-[#FF9F43] text-white shadow-[0_10px_24px_rgba(255,159,67,0.28)]'
              }`}
            >
              {isCurrent ? '正在陪伴我' : '让它陪我'}
            </button>
          )}
        </div>
      </motion.section>
    </motion.div>
  );
}
