'use client';

import { useGlobalStore } from '@/stores/globalStore';
import { LEVELS } from '@/lib/constants';
import { AcademyMap } from '@/components/academy/AcademyMap';
import styles from './academy.module.css';

export default function AcademyPage() {
  const { academyProgress } = useGlobalStore();
  const completedCount = LEVELS.filter(
    (level) => academyProgress[level.id]?.completed,
  ).length;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.titleGroup}>
            <div>
              <span className={styles.eyebrow}>JIU MUSIC ACADEMY</span>
              <h1 className={styles.title}>音乐探索地图</h1>
              <p className={styles.subtitle}>从田野出发，一路唱进山林</p>
            </div>
          </div>
          <div className={styles.progressCount}>
            <span>已完成 </span><strong>{completedCount}</strong> / {LEVELS.length}
          </div>
        </div>
      </header>

      <div className={styles.mapFrame}>
        <AcademyMap progress={academyProgress} />
      </div>
    </main>
  );
}
