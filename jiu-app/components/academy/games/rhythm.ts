// Shared rhythm vocabulary for the Stage-2 games (学院 v3 PRD):
//   大乌龟 = 二分音符(2拍)  🐢  最慢
//   小兔子 = 四分音符(1拍)  🐇
//   小松鼠 = 八分音符(半拍) 🐿️
//   冲刺小兔 = 十六分(1/4拍) ⚡ 最快
// A beat-length array describes a rhythm, e.g. [1, 0.5, 0.5, 1].

export interface NoteAnimal {
  key: 'turtle' | 'rabbit' | 'squirrel' | 'sprinter';
  emoji: string;
  label: string;
  /** Beat length this animal represents. */
  beats: number;
}

export const NOTE_ANIMALS: NoteAnimal[] = [
  { key: 'turtle', emoji: '🐢', label: '大乌龟', beats: 2 },
  { key: 'rabbit', emoji: '🐇', label: '小兔子', beats: 1 },
  { key: 'squirrel', emoji: '🐿️', label: '小松鼠', beats: 0.5 },
  { key: 'sprinter', emoji: '⚡', label: '冲刺小兔', beats: 0.25 },
];

export const BEAT_MS = 420;

export function animalForBeats(beats: number): NoteAnimal {
  return NOTE_ANIMALS.find((animal) => animal.beats === beats) ?? NOTE_ANIMALS[1];
}

export function sumBeats(beats: number[]): number {
  return beats.reduce((sum, beat) => sum + beat, 0);
}

/** Start time (ms) of each note within the bar, using BEAT_MS per beat. */
export function cumulativeStarts(beats: number[]): number[] {
  const starts: number[] = [];
  let cursor = 0;
  for (const beat of beats) {
    starts.push(cursor * BEAT_MS);
    cursor += beat;
  }
  return starts;
}

/** Three echo patterns, each summing to 4 beats. */
export const ECHO_PATTERNS: number[][] = [
  [1, 1, 1, 1],
  [1, 0.5, 0.5, 1, 1],
  [1, 0.5, 0.25, 0.25, 0.5, 0.5, 0.5, 0.5],
];

export const STEADY_BEATS = [1, 1, 1, 1];
export const UNSTEADY_BEATS = [0.5, 2, 1, 0.5, 1, 2];
