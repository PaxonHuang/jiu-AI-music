// Teaching-aid data for every academy level, keyed by the level's `game`
// slug (lib/constants.ts LEVELS[].game). Rendered by LevelPreparation below
// the training-goal card. See components/academy/TeachingAid.tsx.
//
// Concept mapping follows 学院模块需求改动同步文档_v3.md:
//   1-1 声音电梯  -> 小钢琴(Do→Si)
//   1-2 声音天平  -> 大象(强) / 小猫(弱)
//   1-3 长短回声  -> 水滴(短) / 水流(长)
//   2-1 节奏小课堂 -> 节奏跑道(四种音符动物)
//   2-2 节奏拍拍乐 -> 节奏鼓
//   2-3 节奏回声  -> 预设节奏短句
//   3-1 音符小镇  -> 七座音符小屋
//   3-2 音准爬塔  -> 七层高塔
//   3-3 音符找家  -> 五线谱音符位置

import type { TeachingAidItem } from './TeachingAid';

const NOTE_FREQS = {
  Do: 261.63,
  Re: 293.66,
  Mi: 329.63,
  Fa: 349.23,
  Sol: 392.0,
  La: 440.0,
  Si: 493.88,
};

const NOTE_ITEMS: TeachingAidItem[] = [
  { emoji: '🟥', label: 'Do', freq: NOTE_FREQS.Do },
  { emoji: '🟧', label: 'Re', freq: NOTE_FREQS.Re },
  { emoji: '🟨', label: 'Mi', freq: NOTE_FREQS.Mi },
  { emoji: '🟩', label: 'Fa', freq: NOTE_FREQS.Fa },
  { emoji: '🟦', label: 'Sol', freq: NOTE_FREQS.Sol },
  { emoji: '🟪', label: 'La', freq: NOTE_FREQS.La },
  { emoji: '🟫', label: 'Si', freq: NOTE_FREQS.Si },
];

export const TEACHING_AIDS: Record<string, { items: TeachingAidItem[]; caption: string; single?: boolean }> = {
  'sound-elevator': {
    items: NOTE_ITEMS,
    caption: '点击琴键，听听声音的高低。Do 最低，Si 最高。',
  },
  'sound-balance': {
    items: [
      { emoji: '🐘', label: '大象', freq: 196.0, duration: 0.7, volume: 0.5 },
      { emoji: '🐱', label: '小猫', freq: 196.0, duration: 0.3, volume: 0.12 },
    ],
    caption: '大象的声音重，是大声（强音）；小猫的声音轻，是小声（弱音）。',
  },
  'sound-relay': {
    items: [
      { emoji: '💧', label: '水滴', freq: 950, duration: 0.08, volume: 0.3 },
      { emoji: '🌊', label: '水流', freq: 280, duration: 1.2, volume: 0.3 },
    ],
    caption: '水滴嗒一下就没了，是短声音；水流哗——能持续很久，是长声音。',
  },
  'rhythm-class': {
    items: [
      { emoji: '🐢', label: '乌龟', beats: [2] },
      { emoji: '🐇', label: '兔子', beats: [1] },
      { emoji: '🐿️', label: '松鼠', beats: [0.5] },
      { emoji: '⚡', label: '冲刺兔', beats: [0.25] },
    ],
    caption: '乌龟最慢（2 拍），冲刺兔最快（1/4 拍）。点点它们听差别。',
  },
  'rhythm-tap': {
    single: true,
    items: [{ emoji: '🥁', label: '节奏鼓', beats: [1, 1, 1, 1] }],
    caption: '跟着背景的均匀节拍，敲出稳定的鼓点。',
  },
  'rhythm-echo': {
    items: [
      { emoji: '🐢🐢', label: '慢慢走', beats: [2, 2] },
      { emoji: '🐇🐇🐇', label: '小跑步', beats: [1, 1, 1] },
      { emoji: '🐿️🐿️🐿️🐿️', label: '冲刺跑', beats: [0.5, 0.5, 0.5, 0.5] },
    ],
    caption: '听一段节奏，记住它，等下你要把它拼出来。',
  },
  'note-town': {
    items: NOTE_ITEMS,
    caption: '每座小屋住着一个音符，音调高低不一样。',
  },
  'pitch-tower': {
    items: NOTE_ITEMS,
    caption: '塔有七层，楼层越高音调越高。唱准了，小人就往上爬。',
  },
  'note-home': {
    items: NOTE_ITEMS,
    caption: '五线谱有线和间，每个位置住着不同的音符。',
  },
};
