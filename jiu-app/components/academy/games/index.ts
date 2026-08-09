import { AcademyGameKey } from '@/lib/constants';
import { AcademyGameComponent } from './types';
import { SoundElevator } from './SoundElevator';
import { SoundRelay } from './SoundRelay';
import { SoundBalance } from './SoundBalance';
import { RhythmClass } from './RhythmClass';
import { RhythmTap } from './RhythmTap';
import { RhythmEcho } from './RhythmEcho';
import { NoteTown } from './NoteTown';
import { PitchTower } from './PitchTower';
import { NoteHome } from './NoteHome';

export const ACADEMY_GAMES: Record<AcademyGameKey, AcademyGameComponent> = {
  'sound-elevator': SoundElevator,
  'sound-relay': SoundRelay,
  'sound-balance': SoundBalance,
  'rhythm-class': RhythmClass,
  'rhythm-tap': RhythmTap,
  'rhythm-echo': RhythmEcho,
  'note-town': NoteTown,
  'pitch-tower': PitchTower,
  'note-home': NoteHome,
};
