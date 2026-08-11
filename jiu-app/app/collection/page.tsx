'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BIRDS, Bird, CATEGORY_LABELS, FragmentType } from '@/lib/constants';
import { useGlobalStore } from '@/stores/globalStore';
import { BirdCard } from '@/components/collection/BirdCard';
import { BirdDetail } from '@/components/collection/BirdDetail';
import { BirdPortrait } from '@/components/collection/BirdPortrait';
import { PageHeader } from '@/components/layout/PageHeader';
import styles from './collection.module.css';

const CATEGORIES = ['cute', 'abstract', 'mystery'] as const;

const CATEGORY_META = {
  cute: {
    eyebrow: '轻轻落在手心里的朋友',
    subtitle: '软乎乎的音乐伙伴',
    className: styles.cute,
  },
  abstract: {
    eyebrow: '声音和长相都出人意料',
    subtitle: '古灵精怪的节奏大师',
    className: styles.abstract,
  },
  mystery: {
    eyebrow: '耐心探索才能遇见',
    subtitle: '来自远方的稀有伙伴',
    className: styles.mystery,
  },
} as const;

const FRAGMENT_META: Record<FragmentType, {
  mark: string;
  tone: string;
  description: string;
  sources: string[];
  href: string;
  action: string;
}> = {
  绒羽: {
    mark: '✦',
    tone: 'from-[#FFF3C9] to-[#FFE2BA]',
    description: '记录每一次小小的坚持',
    sources: ['每日首次登录', '完成基础练习', '分享自己的作品'],
    href: '/academy',
    action: '去学院练习',
  },
  怪羽: {
    mark: '◆',
    tone: 'from-[#DDF5EB] to-[#CDE9E4]',
    description: '奖励认真学习和勇敢创作',
    sources: ['完整学完一节课程', '连续三天完成学习', '首次完成一段旋律'],
    href: '/workshop',
    action: '去工坊创作',
  },
  暗羽: {
    mark: '✧',
    tone: 'from-[#E9E4FF] to-[#D9D6F8]',
    description: '只属于挑战者的稀有碎片',
    sources: ['节奏或听音挑战满分', '完成创作里程碑', '发现隐藏彩蛋'],
    href: '/community',
    action: '去探索挑战',
  },
};

export default function CollectionPage() {
  const { currentBirdId, fragments, unlockedBirds } = useGlobalStore();
  const [selectedBird, setSelectedBird] = useState<Bird | null>(null);
  const [showFragmentGuide, setShowFragmentGuide] = useState(false);
  const [activeCategory, setActiveCategory] =
    useState<(typeof CATEGORIES)[number]>('cute');
  const categoryNavRef = useRef<HTMLElement | null>(null);
  const categoryRefs = useRef<Record<(typeof CATEGORIES)[number], HTMLElement | null>>({
    cute: null,
    abstract: null,
    mystery: null,
  });
  const currentBird = BIRDS.find((bird) => bird.id === currentBirdId) ?? BIRDS[0];
  const discoveredCount = BIRDS.filter((bird) => unlockedBirds.includes(bird.id)).length;

  useEffect(() => {
    let frame = 0;
    const syncActiveCategory = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const anchor = categoryNavRef.current?.getBoundingClientRect().bottom ?? 0;
        let visibleCategory: (typeof CATEGORIES)[number] = CATEGORIES[0];
        let largestVisibleArea = 0;

        for (const category of CATEGORIES) {
          const section = categoryRefs.current[category];
          if (!section) continue;
          const bounds = section.getBoundingClientRect();
          const visibleArea = Math.max(
            0,
            Math.min(bounds.bottom, window.innerHeight) - Math.max(bounds.top, anchor),
          );
          if (visibleArea > largestVisibleArea) {
            largestVisibleArea = visibleArea;
            visibleCategory = category;
          }
        }

        setActiveCategory((current) =>
          current === visibleCategory ? current : visibleCategory,
        );
      });
    };

    syncActiveCategory();
    window.addEventListener('scroll', syncActiveCategory, { passive: true });
    window.addEventListener('resize', syncActiveCategory);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', syncActiveCategory);
      window.removeEventListener('resize', syncActiveCategory);
    };
  }, []);

  const jumpToCategory = (category: (typeof CATEGORIES)[number]) => {
    setActiveCategory(category);
    document.getElementById(`collection-${category}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="JIU BIRD COLLECTION"
        title="我的鸟库"
        subtitle="发现鸟儿，找到你的音乐伙伴"
        right={
          <div className="rounded-full border border-[#E8D5C2] bg-white/75 px-3 py-1.5 text-xs font-extrabold text-[#795C44]">
            已发现 <span className="text-[#E47A24]">{discoveredCount}</span> / {BIRDS.length}
          </div>
        }
      />

      <section className={styles.hero} aria-label="当前音乐伙伴">
        <div className={styles.heroGlowOne} />
        <div className={styles.heroGlowTwo} />
        <div className="relative z-10 flex min-w-0 flex-1 flex-col items-start py-5 pl-5">
          <span className="rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-black text-[#52715E]">
            CURRENT PARTNER · 当前伙伴
          </span>
          <h2 className="mt-3 text-[25px] font-black tracking-tight text-[#263746]">
            {currentBird.name}
          </h2>
          <p className="mt-1 max-w-[185px] text-xs leading-5 text-[#67594E]">
            今天也一起听声音、找节拍，创造新的音乐吧！
          </p>
          <button
            type="button"
            onClick={() => setSelectedBird(currentBird)}
            className="mt-3 min-h-9 rounded-full bg-[#2C3E50] px-4 text-[11px] font-extrabold text-white shadow-sm"
          >
            认识我的伙伴
          </button>
        </div>
        <BirdPortrait
          bird={currentBird}
          className="relative z-10 -mr-3 aspect-square w-[46%] max-w-[190px] self-end"
        />
      </section>

      <nav ref={categoryNavRef} className={styles.categoryNav} aria-label="鸟类分类">
        {CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => jumpToCategory(category)}
            className={`min-h-10 whitespace-nowrap rounded-full px-4 text-xs font-extrabold transition ${
              activeCategory === category
                ? 'bg-[#2C3E50] text-white shadow-md'
                : 'bg-white/80 text-[#75685D]'
            }`}
          >
            {CATEGORY_LABELS[category]}
          </button>
        ))}
      </nav>

      <section className="px-4 pt-4" aria-labelledby="fragment-wallet-title">
        <div className="mb-2.5 flex items-center justify-between">
          <h2 id="fragment-wallet-title" className="text-sm font-black text-[#374754]">
            我的羽毛碎片
          </h2>
          <button
            type="button"
            onClick={() => setShowFragmentGuide(true)}
            className="min-h-8 rounded-full px-2 text-[11px] font-bold text-[#A05C28]"
          >
            怎么获得？
          </button>
        </div>
        <button
          type="button"
          onClick={() => setShowFragmentGuide(true)}
          className="grid w-full grid-cols-3 gap-2 text-left"
          aria-label="查看碎片获取方式"
        >
          {(Object.keys(FRAGMENT_META) as FragmentType[]).map((type) => {
            const item = FRAGMENT_META[type];
            return (
              <span
                key={type}
                className={`rounded-[18px] bg-gradient-to-br ${item.tone} px-3 py-3 shadow-[0_7px_18px_rgba(68,50,37,0.06)]`}
              >
                <span className="flex items-center gap-1 text-[10px] font-bold text-[#796B5F]">
                  <span className="text-sm" aria-hidden="true">{item.mark}</span>
                  {type}
                </span>
                <strong className="mt-1 block text-xl font-black tabular-nums text-[#31414C]">
                  {fragments[type]}
                </strong>
              </span>
            );
          })}
        </button>
      </section>

      <div className="space-y-4 px-3 pb-10">
        {CATEGORIES.map((category) => {
          const birds = BIRDS.filter((bird) => bird.category === category);
          const categoryUnlocked = birds.filter((bird) => unlockedBirds.includes(bird.id)).length;
          const meta = CATEGORY_META[category];

          return (
            <section
              key={category}
              id={`collection-${category}`}
              ref={(element) => {
                categoryRefs.current[category] = element;
              }}
              className={`${styles.categorySection} ${meta.className}`}
            >
              <div className={styles.categoryDecoration} aria-hidden="true" />
              <div className="relative z-10 flex items-end justify-between px-4 pb-3 pt-5">
                <div>
                  <p className="text-[10px] font-bold tracking-[0.12em] text-[#76675B]/75">
                    {meta.eyebrow}
                  </p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <h2 className="text-xl font-black text-[#263746]">
                      {CATEGORY_LABELS[category]}
                    </h2>
                    <span className="text-[11px] font-extrabold text-[#75685D]">
                      {categoryUnlocked}/{birds.length}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-[#75685D]">{meta.subtitle}</p>
                </div>
                <span className="text-[10px] font-bold text-[#75685D]/70">左右滑动</span>
              </div>

              <div className={styles.cardsRow}>
                {birds.map((bird) => (
                  <BirdCard
                    key={bird.id}
                    bird={bird}
                    onOpen={() => setSelectedBird(bird)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <AnimatePresence>
        {selectedBird && (
          <BirdDetail bird={selectedBird} onClose={() => setSelectedBird(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showFragmentGuide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[75] flex items-end justify-center bg-[#16202A]/55 backdrop-blur-[2px]"
            onClick={() => setShowFragmentGuide(false)}
            role="presentation"
          >
            <motion.section
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-[30px] bg-[#FFF9F2] px-5 pb-8 pt-3"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="fragment-guide-title"
            >
              <div className="mx-auto h-1.5 w-12 rounded-full bg-[#D8CFC5]" />
              <div className="mt-5 flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold tracking-[0.16em] text-[#A77950]">
                    KEEP EXPLORING
                  </p>
                  <h2 id="fragment-guide-title" className="mt-1 text-2xl font-black text-[#263746]">
                    每次行动，都有奖励
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-[#7D7065]">
                    使用学院、工坊和社区，收集不同的羽毛碎片。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFragmentGuide(false)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-lg font-bold text-[#6F655D] shadow-sm"
                  aria-label="关闭碎片说明"
                >
                  ×
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {(Object.keys(FRAGMENT_META) as FragmentType[]).map((type) => {
                  const item = FRAGMENT_META[type];
                  return (
                    <article key={type} className={`rounded-[22px] bg-gradient-to-br ${item.tone} p-4`}>
                      <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/65 text-xl text-[#51483F]">
                          {item.mark}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <h3 className="text-base font-black text-[#34434D]">{type}碎片</h3>
                            <strong className="text-lg font-black text-[#34434D]">
                              × {fragments[type]}
                            </strong>
                          </div>
                          <p className="text-[11px] text-[#75695F]">{item.description}</p>
                        </div>
                      </div>
                      <ul className="mt-3 grid gap-1.5 text-xs text-[#61574F]">
                        {item.sources.map((source) => (
                          <li key={source} className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#FF9F43]" />
                            {source}
                          </li>
                        ))}
                      </ul>
                      <Link
                        href={item.href}
                        onClick={() => setShowFragmentGuide(false)}
                        className="mt-3 flex min-h-10 items-center justify-center rounded-full bg-white/75 px-4 text-xs font-extrabold text-[#76502F]"
                      >
                        {item.action} →
                      </Link>
                    </article>
                  );
                })}
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
