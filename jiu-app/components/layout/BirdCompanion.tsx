'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useGlobalStore } from '@/stores/globalStore';
import { BIRDS } from '@/lib/constants';
import { BirdPortrait } from '@/components/collection/BirdPortrait';

const QUICK_QUESTIONS = [
  '什么是音高？',
  '节拍是什么？',
  'Do Re Mi 是什么？',
  '怎么创作音乐？',
  '鸟为什么会唱歌？',
];

export function BirdCompanion() {
  const pathname = usePathname();
  const { currentBirdId } = useGlobalStore();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const bird = BIRDS.find((b) => b.id === currentBirdId) || BIRDS[0];

  const handleQuestion = (q: string) => {
    setMessages((prev) => [...prev, { role: 'user', text: q }]);
    setTimeout(() => {
      const answers: Record<string, string> = {
        '什么是音高？': '声音有高有低，就像楼梯一样。小鸟唱得高，大象叫得低！',
        '节拍是什么？': '就像你的心跳一样，咚、咚、咚，很稳定的节奏就是节拍！',
        'Do Re Mi 是什么？': '这是音乐的七个小伙伴中的前三个，就像 ABC 是字母歌的开头一样！',
        '怎么创作音乐？': '去工坊写下一句话，再选曲风和心情，我就能陪你把故事变成一首歌！',
        '鸟为什么会唱歌？': '鸟儿唱歌是为了和朋友聊天、标记领地，和你唱歌为了开心是一样的！',
      };
      setMessages((prev) => [
        ...prev,
        { role: 'bird', text: answers[q] || '好问题！让我们一起去探索音乐的世界吧！' },
      ]);
    }, 800);
  };

  if (pathname.startsWith('/workshop')) return null;

  return (
    <div className="fixed bottom-20 right-3 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="mb-3 w-72 rounded-2xl bg-white shadow-xl border border-gray-100 overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-100 to-blue-50 px-4 py-2 flex items-center gap-2">
              <span className="text-lg">{bird.name}</span>
              <span className="text-xs text-gray-500">· 伴学助手</span>
            </div>

            {/* Messages */}
            <div className="h-48 overflow-y-auto p-3 space-y-2 text-sm">
              {messages.length === 0 && (
                <div className="text-gray-400 text-center py-4">
                  点击下方问题向我提问吧！
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-2xl ${
                      msg.role === 'user'
                        ? 'bg-orange-100 text-gray-800 rounded-br-sm'
                        : 'bg-gray-100 text-gray-700 rounded-bl-sm'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Questions */}
            <div className="border-t border-gray-100 p-2 flex flex-wrap gap-1.5">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => handleQuestion(q)}
                  className="text-xs bg-orange-50 text-orange-600 px-2.5 py-1 rounded-full hover:bg-orange-100 active:scale-95 transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 overflow-hidden rounded-full bg-gradient-to-br from-orange-50 to-emerald-50 shadow-lg border-2 border-orange-200 flex items-center justify-center"
        aria-label={isOpen ? '收起伴学助手' : `向${bird.name}提问`}
      >
        <BirdPortrait bird={bird} className="h-full w-full" />
      </motion.button>
    </div>
  );
}
