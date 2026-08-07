// localStorage access for workshop drafts and the works library.
//
// Ported from the collaborator branch's lib/workshop/storage.ts. Keys are
// scoped per user (`jiu_workshop_works:<userId>`) so two accounts on one
// device do not see each other's songs, with a read-through fallback to the
// original unscoped key — that fallback is what makes works saved before this
// change still appear.

import { normalizeStoredDraft, normalizeStoredPublishedWorks } from './normalize.ts';
import type { PublishedWork, WorkshopDraft } from './works.ts';

const DRAFT_KEY = 'jiu_workshop_draft';
const WORKS_KEY = 'jiu_workshop_works';

export function getWorkshopDraftStorageKey(activeUserId: string | null): string {
  return activeUserId ? `${DRAFT_KEY}:${activeUserId}` : DRAFT_KEY;
}

export function getWorkshopWorksStorageKey(activeUserId: string | null): string {
  return activeUserId ? `${WORKS_KEY}:${activeUserId}` : WORKS_KEY;
}

export function readWorkshopDraft(activeUserId: string | null): WorkshopDraft | null {
  const storage = getStorage();
  if (!storage) return null;

  const scoped = normalizeStoredDraft(storage.getItem(getWorkshopDraftStorageKey(activeUserId)));
  if (scoped) return scoped;

  return normalizeStoredDraft(storage.getItem(DRAFT_KEY));
}

export function readWorkshopWorks(activeUserId: string | null): PublishedWork[] {
  const storage = getStorage();
  if (!storage) return [];

  const scoped = normalizeStoredPublishedWorks(
    storage.getItem(getWorkshopWorksStorageKey(activeUserId)),
  );
  if (scoped && scoped.length > 0) return scoped;

  // Pre-scoping records live at the bare key.
  return normalizeStoredPublishedWorks(storage.getItem(WORKS_KEY)) ?? [];
}

export function writeWorkshopDraft(activeUserId: string | null, draft: WorkshopDraft): void {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(getWorkshopDraftStorageKey(activeUserId), JSON.stringify(draft));
}

export function writeWorkshopWork(activeUserId: string | null, work: PublishedWork): void {
  const storage = getStorage();
  if (!storage) return;

  const existing = readWorkshopWorks(activeUserId);
  const next = [work, ...existing.filter((item) => item.id !== work.id)];
  storage.setItem(getWorkshopWorksStorageKey(activeUserId), JSON.stringify(next));
}

export function deleteWorkshopWork(activeUserId: string | null, id: number): void {
  const storage = getStorage();
  if (!storage) return;
  const next = readWorkshopWorks(activeUserId).filter((item) => item.id !== id);
  storage.setItem(getWorkshopWorksStorageKey(activeUserId), JSON.stringify(next));
}

function getStorage(): Storage | null {
  if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) return null;
  return globalThis.localStorage;
}
