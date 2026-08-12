// Tolerant readers for anything that comes back out of localStorage.
//
// Ported from the collaborator branch's lib/workshop/normalize.ts. Stored
// records predate several fields (createdAt, authorId, sourceProvider,
// lyrics), so every optional field degrades instead of rejecting the record —
// that is what keeps already-saved works readable after this change.

import { DEFAULT_DRAFT, type PublishedWork, type WorkshopDraft } from './works.ts';

export function normalizeStoredDraft(raw: string | null): WorkshopDraft | null {
  const parsed = parseJson(raw);
  if (!isRecord(parsed)) return null;

  const { lyricsMode, voice } = parsed;
  if (!isLyricsMode(lyricsMode) || !isVoice(voice)) return null;

  return {
    title: str(parsed.title) ?? DEFAULT_DRAFT.title,
    idea: str(parsed.idea) ?? DEFAULT_DRAFT.idea,
    lyrics: str(parsed.lyrics) ?? DEFAULT_DRAFT.lyrics,
    lyricsMode,
    instrumental:
      typeof parsed.instrumental === 'boolean' ? parsed.instrumental : DEFAULT_DRAFT.instrumental,
    genre: str(parsed.genre) ?? DEFAULT_DRAFT.genre,
    mood: str(parsed.mood) ?? DEFAULT_DRAFT.mood,
    voice,
    instruments: strArray(parsed.instruments) ?? [...DEFAULT_DRAFT.instruments],
  };
}

export function normalizeStoredPublishedWorks(raw: string | null): PublishedWork[] | null {
  const parsed = parseJson(raw);
  if (!Array.isArray(parsed)) return null;

  return parsed.flatMap((entry) => {
    if (!isRecord(entry)) return [];

    // Required by every stored generation, old or new.
    const title = str(entry.title);
    const audio = str(entry.audio);
    const genre = str(entry.genre);
    const mood = str(entry.mood);
    if (typeof entry.id !== 'number' || title === null || audio === null) return [];
    if (genre === null || mood === null) return [];
    if (entry.status !== 'saved' && entry.status !== 'published') return [];

    const work: PublishedWork = {
      id: entry.id,
      taskId: str(entry.taskId) ?? undefined,
      title,
      status: entry.status,
      audio,
      caption: str(entry.caption) ?? undefined,
      emoji: str(entry.emoji) ?? undefined,
      genre,
      mood,
      createdAt: str(entry.createdAt) ?? new Date().toISOString(),
      authorId: str(entry.authorId) ?? undefined,
      sourceProvider:
        entry.sourceProvider === 'upstream' || entry.sourceProvider === 'local'
          ? entry.sourceProvider
          : undefined,
      lyrics: str(entry.lyrics) ?? undefined,
      instruments: strArray(entry.instruments) ?? undefined,
      remoteId: str(entry.remoteId) ?? undefined,
    };
    return [work];
  });
}

function parseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function strArray(value: unknown): string[] | null {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : null;
}

function isLyricsMode(value: unknown): value is WorkshopDraft['lyricsMode'] {
  return value === 'ai' || value === 'write' || value === 'continue';
}

function isVoice(value: unknown): value is WorkshopDraft['voice'] {
  return value === 'female' || value === 'male';
}
