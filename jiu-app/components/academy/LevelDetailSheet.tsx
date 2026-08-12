'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { LEVELS } from '@/lib/constants';
import { LevelStatus } from './LevelNode';
import styles from '@/app/academy/academy.module.css';

type Level = (typeof LEVELS)[number];

interface LevelDetailSheetProps {
  level: Level;
  status: LevelStatus;
  bestScore?: number;
  onClose: () => void;
}

const STATUS_COPY: Record<LevelStatus, string> = {
  completed: '已通关',
  current: '当前关卡',
  locked: '尚未解锁',
};

export function LevelDetailSheet({
  level,
  status,
  bestScore,
  onClose,
}: LevelDetailSheetProps) {
  const isLocked = status === 'locked';

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className={styles.modalLayer}
      role="presentation"
      onClick={onClose}
    >
      <motion.div
        className={styles.modalBackdrop}
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.section
        className={styles.detailModal}
        role="dialog"
        aria-modal="true"
        aria-label={`${level.name}关卡详情`}
        initial={{ opacity: 0, y: '100%' }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#D8CFC5]" aria-hidden="true" />
        <button
          type="button"
          className={styles.detailClose}
          aria-label="关闭关卡详情"
          onClick={onClose}
        >
          ×
        </button>

        <div className={styles.detailHeading}>
          <span className={`${styles.detailIcon} ${styles[status]}`} aria-hidden="true">
            {status === 'completed' ? '⭐' : isLocked ? '🔒' : level.icon}
          </span>
          <div className={styles.detailTitleGroup}>
            <span className={styles.detailEyebrow}>
              第 {level.stageId} 阶段 · {level.stageName} · {level.stageId}-{level.lesson}
            </span>
            <h2>{level.name}</h2>
            <p>{level.subtitle}</p>
          </div>
        </div>

        <div className={styles.detailMeta}>
          <span className={`${styles.detailStatus} ${styles[status]}`}>
            {STATUS_COPY[status]}
          </span>
          <span>📍 {level.zone}</span>
          {status === 'completed' && bestScore !== undefined && (
            <span>🏆 最高 {bestScore} 分</span>
          )}
        </div>

        <div className={styles.goalCard}>
          <span className={styles.sectionLabel}>训练目标</span>
          <strong>{level.subtitle}</strong>
          <p>{level.companionTip}</p>
        </div>

        <div className={styles.rewardBlock}>
          <span className={styles.sectionLabel}>通关奖励</span>
          <div className={styles.rewardGrid}>
            <div className={styles.rewardItem}>
              <span aria-hidden="true">🎁</span>
              <div>
                <strong>2 枚{level.rewardType}</strong>
                <small>完成关卡</small>
              </div>
            </div>
            <div className={styles.rewardItem}>
              <span aria-hidden="true">✨</span>
              <div>
                <strong>额外 +1 枚</strong>
                <small>完美通关</small>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.detailFooter}>
          <p>
            {isLocked
              ? '完成上一关后即可解锁'
              : status === 'completed'
                ? '可以再次挑战，刷新你的最高分'
                : '准备好后，开始本关音乐挑战'}
          </p>
          {isLocked ? (
            <button type="button" className={styles.lockedAction} disabled>
              🔒 尚未解锁
            </button>
          ) : (
            <Link href={`/academy/level/${level.id}`} className={styles.detailAction}>
              {status === 'completed' ? '再次挑战' : '开始挑战'}
              <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      </motion.section>
    </div>
  );
}
