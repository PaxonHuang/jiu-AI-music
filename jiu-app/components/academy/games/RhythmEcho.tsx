'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { AcademyGameProps } from './types';
import { GameIntro, RoundProgress, SimpleModeNotice, AnswerFeedback } from './GameUI';
import { playRhythm } from './audio';
import { animalForBeats, ECHO_PATTERNS, NOTE_ANIMALS } from './rhythm';

// 2-3 节奏回声:听一段混合节奏,然后靠记忆拖拽小动物还原
//   完全匹配即通关,拼错自动重播示范(无惩罚),共 3 组

type EchoStatus = 'idle' | 'correct' | 'wrong';

export function RhythmEcho({ onComplete, onMistake, simpleMode }: AcademyGameProps) {
  const patterns = simpleMode ? ECHO_PATTERNS.slice(0, 2) : ECHO_PATTERNS;
  const [round, setRound] = useState(0);
  const [built, setBuilt] = useState<number[]>([]);
  const [status, setStatus] = useState<EchoStatus>('idle');
  const [isPlaying, setIsPlaying] = useState(false);
  const wrongRoundsRef = useRef(0);
  const playbackTimerRef = useRef<number | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const target = patterns[round];
  const usedBeats = useMemo(() => built.reduce((sum, note) => sum + note, 0), [built]);

  const playTarget = useCallback(async () => {
    setIsPlaying(true);
    const duration = await playRhythm(target);
    playbackTimerRef.current = window.setTimeout(() => {
      setIsPlaying(false);
      playbackTimerRef.current = null;
    }, duration + 100);
  }, [target]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void playTarget(), 420);
    return () => {
      window.clearTimeout(timeout);
      if (playbackTimerRef.current) window.clearTimeout(playbackTimerRef.current);
    };
  }, [playTarget]);

  const addAnimal = (beats: number) => {
    if (isPlaying || status !== 'idle' || usedBeats + beats > 4) return;
    setBuilt((items) => [...items, beats]);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over?.id !== 'echo-strip') return;
    const beats = Number(active.id);
    if (!Number.isFinite(beats)) return;
    addAnimal(beats);
  };

  const submit = () => {
    if (isPlaying || usedBeats !== 4) return;
    const isCorrect =
      built.length === target.length && built.every((value, index) => value === target[index]);
    if (!isCorrect) {
      wrongRoundsRef.current += 1;
      onMistake();
      setStatus('wrong');
      window.setTimeout(() => {
        setBuilt([]);
        setStatus('idle');
        void playTarget();
      }, 700);
      return;
    }
    setStatus('correct');
    void playRhythm(built);
    window.setTimeout(() => {
      if (round >= patterns.length - 1) {
        onComplete(wrongRoundsRef.current === 0 ? 3 : 2);
      } else {
        setRound((value) => value + 1);
        setBuilt([]);
        setStatus('idle');
      }
    }, 950);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex flex-col items-center gap-2.5 sm:gap-4">
        <GameIntro detail="认真听示范，然后把小动物拖回轨道，拼出一模一样的节奏">
          🐾 节奏回声
        </GameIntro>
        <SimpleModeNotice show={simpleMode} />
        <RoundProgress current={round} total={patterns.length} label="回声进度" />

        <div className="w-full max-w-sm rounded-[1.5rem] border border-violet-100 bg-gradient-to-b from-violet-50 via-white to-fuchsia-50 p-3 shadow-inner sm:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-600">
                节奏回声轨道
              </p>
              <p className="mt-0.5 text-xs font-black text-slate-700 sm:text-sm">
                把 4 拍节奏拼回原样
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                isPlaying
                  ? 'bg-blue-100 text-blue-600'
                  : status === 'correct'
                    ? 'bg-green-100 text-green-600'
                    : status === 'wrong'
                      ? 'bg-red-100 text-red-600'
                      : 'bg-slate-100 text-slate-500'
              }`}
              aria-live="polite"
            >
              {isPlaying ? '示范播放中' : status === 'correct' ? '还原正确' : status === 'wrong' ? '再听一次' : `${usedBeats} / 4 拍`}
            </span>
          </div>

          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between text-[10px] font-black text-slate-400">
              <span>你的节奏回声</span>
              <button
                type="button"
                onClick={() => void playTarget()}
                disabled={isPlaying || status !== 'idle'}
                className="font-black text-violet-500 underline disabled:opacity-50"
              >
                {isPlaying ? '播放中…' : '🔁 再听一次'}
              </button>
            </div>
            <DroppableEchoStrip
              built={built}
              emptyText="拖小动物进来，或直接点下面的小动物"
              showHint={simpleMode}
              hint={target}
            />
          </div>

          <div className="mt-3">
            <p className="mb-1.5 text-[10px] font-black text-slate-400">小动物素材</p>
            <div className="flex justify-center gap-2.5">
              {NOTE_ANIMALS.map((animal) => (
                <AnimalBlock key={animal.key} animal={animal} onAdd={() => addAnimal(animal.beats)} />
              ))}
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setBuilt((items) => items.slice(0, -1))}
              disabled={built.length === 0 || isPlaying || status !== 'idle'}
              className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-black text-slate-600 disabled:opacity-50"
            >
              ← 撤回
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={usedBeats !== 4 || isPlaying || status !== 'idle'}
              className="flex-[1.4] rounded-xl bg-violet-500 py-2.5 text-xs font-black text-white shadow-sm disabled:bg-slate-300"
            >
              完成回声
            </button>
          </div>
        </div>

        <AnswerFeedback type={status === 'idle' ? null : status}>
          {status === 'correct' ? '一模一样，太棒了！' : '再听一次，然后重新拼'}
        </AnswerFeedback>
      </div>
    </DndContext>
  );
}

function AnimalBlock({
  animal,
  onAdd,
}: {
  animal: (typeof NOTE_ANIMALS)[number];
  onAdd: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: animal.beats,
  });
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      type="button"
      onClick={onAdd}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        touchAction: 'none',
      }}
      className={`flex flex-col items-center rounded-xl border-2 px-3 py-2 shadow-sm transition ${
        isDragging ? 'z-50 scale-105 opacity-80' : 'border-violet-100 bg-white'
      }`}
    >
      <span className="text-2xl">{animal.emoji}</span>
      <span className="mt-0.5 text-[9px] font-bold text-slate-500">{animal.label}</span>
    </button>
  );
}

function DroppableEchoStrip({
  built,
  emptyText,
  showHint,
  hint,
}: {
  built: number[];
  emptyText: string;
  showHint: boolean;
  hint: number[];
}) {
  const { isOver, setNodeRef } = useDroppable({ id: 'echo-strip' });
  return (
    <div ref={setNodeRef}>
      <div
        className={`relative flex min-h-16 w-full items-center gap-1 overflow-hidden rounded-2xl border-2 px-2.5 py-2 transition ${
          isOver ? 'border-green-400 bg-green-50' : 'border-dashed border-slate-300 bg-white/80'
        }`}
      >
        <div className="absolute inset-x-2 top-1/2 border-t border-dashed border-slate-200" />
        {built.length === 0 ? (
          <span className="relative z-10 w-full text-center text-[11px] font-bold text-slate-400">
            {emptyText}
          </span>
        ) : (
          built.map((beats, index) => {
            const animal = animalForBeats(beats);
            return (
              <div
                key={`${beats}-${index}`}
                className="relative z-10 flex items-center justify-center rounded-lg bg-violet-100 py-2"
                style={{ flex: beats, minWidth: 0 }}
              >
                <span className="text-xl">{animal.emoji}</span>
              </div>
            );
          })
        )}
        {showHint && built.length === 0 && (
          <div className="pointer-events-none absolute inset-x-2 top-1/2 z-0 flex -translate-y-1/2 items-center gap-1 opacity-30">
            {hint.map((beats, index) => (
              <span key={index} className="text-lg" style={{ flex: beats }}>
                {animalForBeats(beats).emoji}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
