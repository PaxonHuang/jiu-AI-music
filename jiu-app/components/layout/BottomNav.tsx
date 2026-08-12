'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/academy', label: '学院', icon: '🎓' },
  { href: '/workshop', label: '工坊', icon: '🎵' },
  { href: '/community', label: '社区', icon: '🌟' },
  { href: '/collection', label: '图鉴', icon: '🐦' },
  { href: '/me', label: '我', icon: '👤' },
];

export function BottomNav() {
  const pathname = usePathname();
  const active = tabs.find((t) => pathname.startsWith(t.href))?.href || '/collection';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 safe-area-bottom">
      <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-all ${
              active === tab.href
                ? 'text-[#FF9F43] scale-110 font-bold'
                : 'text-gray-400'
            }`}
          >
            <span className="text-xl">{tab.icon}</span>
            <span className="text-[11px] mt-0.5">{tab.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
