'use client';
import { useEffect, useState } from 'react';
import { useGlobalStore } from '@/stores/globalStore';
import { BottomNav } from '@/components/layout/BottomNav';
import { BirdCompanion } from '@/components/layout/BirdCompanion';
import { Onboarding } from '@/components/shared/Onboarding';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const { init } = useGlobalStore();
  const [mounted, setMounted] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    init();
    setMounted(true);
    const onboarded = localStorage.getItem('jiu_onboarded');
    if (!onboarded) setShowOnboarding(true);
  }, [init]);

  if (!mounted) {
    return (
      <html lang="zh-CN">
        <body className="bg-[#FFF8F0]">
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-4xl animate-bounce">🐦</div>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="zh-CN">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <title>啾 · 儿童 AI 音乐创作</title>
      </head>
      <body className="bg-[#FFF8F0] max-w-lg mx-auto relative min-h-screen">
        {showOnboarding && <Onboarding onComplete={() => setShowOnboarding(false)} />}
        {children}
        <BottomNav />
        <BirdCompanion />
      </body>
    </html>
  );
}
