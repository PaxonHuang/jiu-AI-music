// Client-side workshop types, shared by normalize.ts and storage.ts.
//
// Kept separate from ./types.ts, which is the server-side MusicProvider
// contract. These mirror the collaborator branch's lib/workshop/types.ts so
// the two trees stay mergeable; the id vocabulary (pop / happy / piano)
// already matches lib/constants.ts, so no translation is needed.

export type WorkshopProviderName = 'upstream' | 'local';

export type LyricsMode = 'ai' | 'write' | 'continue';

export type Voice = 'female' | 'male';

export interface WorkshopDraft {
  title: string;
  idea: string;
  lyrics: string;
  lyricsMode: LyricsMode;
  instrumental: boolean;
  genre: string;
  mood: string;
  voice: Voice;
  instruments: string[];
}

// Superset of the shape the workshop page has been writing to
// localStorage['jiu_workshop_works']: the extra fields are all optional, so
// existing records normalise cleanly.
export interface PublishedWork {
  id: number;
  taskId?: string;
  title: string;
  status: 'saved' | 'published';
  audio: string;
  caption?: string;
  emoji?: string;
  genre: string;
  mood: string;
  createdAt: string;
  authorId?: string;
  sourceProvider?: WorkshopProviderName;
  lyrics?: string;
  instruments?: string[];
  /** Set once the work has been published to the community API. */
  remoteId?: string;
}

export const DEFAULT_DRAFT: WorkshopDraft = {
  title: '',
  idea: '',
  lyrics: '',
  lyricsMode: 'ai',
  instrumental: false,
  genre: 'pop',
  mood: 'happy',
  voice: 'female',
  instruments: ['piano'],
};
