// Local persistence for workshop drafts (localStorage) and the works library
// (IndexedDB, with a read-through fallback to localStorage).
//
// Drafts stay in localStorage: they are small, written constantly while typing,
// and a synchronous write during a keystroke is cheaper than an async flush.
//
// Works moved to IndexedDB (lib/workshop/idb.ts):
//   * generated WAVs (~10MB) exceed the localStorage quota
//   * storing the audio Blob next to the work makes playback work offline
// Records saved before this change (localStorage, scoped or unscoped) are
// migrated into IndexedDB on first read; if IndexedDB is unavailable the old
// localStorage path is still used, so nothing silently disappears.

import { normalizeStoredDraft, normalizeStoredPublishedWorks } from './normalize.ts';
import type { PublishedWork, WorkshopDraft } from './works.ts';
import {
  deleteWorkRecord,
  getAllWorkRecords,
  getWorkRecord,
  openWorksDb,
  putWorkRecord,
  type WorkRecord,
} from './idb.ts';

const DRAFT_KEY = 'jiu_workshop_draft';
const WORKS_KEY = 'jiu_workshop_works';

export function getWorkshopDraftStorageKey(activeUserId: string | null): string {
  return activeUserId ? `${DRAFT_KEY}:${activeUserId}` : DRAFT_KEY;
}

export function getWorkshopWorksStorageKey(activeUserId: string | null): string {
  return activeUserId ? `${WORKS_KEY}:${activeUserId}` : WORKS_KEY;
}

// ---------- draft (localStorage, synchronous) ----------

export function readWorkshopDraft(activeUserId: string | null): WorkshopDraft | null {
  const storage = getLocalStorage();
  if (!storage) return null;

  const scoped = normalizeStoredDraft(storage.getItem(getWorkshopDraftStorageKey(activeUserId)));
  if (scoped) return scoped;

  return normalizeStoredDraft(storage.getItem(DRAFT_KEY));
}

export function writeWorkshopDraft(activeUserId: string | null, draft: WorkshopDraft): void {
  const storage = getLocalStorage();
  if (!storage) return;
  storage.setItem(getWorkshopDraftStorageKey(activeUserId), JSON.stringify(draft));
}

// ---------- works (IndexedDB primary, localStorage fallback) ----------

export async function readWorkshopWorks(activeUserId: string | null): Promise<PublishedWork[]> {
  const db = await openWorksDb().catch(() => null);
  if (!db) return legacyReadWorks(activeUserId);

  try {
    let records = await getAllWorkRecords(db);
    if (records.length === 0) {
      // One-time migration of works saved under the old localStorage keys.
      const legacy = legacyReadWorks(activeUserId);
      if (legacy.length > 0) {
        records = legacy.map((work) => ({ id: work.id, userId: activeUserId, work }));
        await Promise.all(records.map((record) => putWorkRecord(db, record)));
      }
    }
    return records
      .filter((record) => record.userId === activeUserId)
      .map((record) => withBlobUrl(record))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  } finally {
    db.close();
  }
}

export async function writeWorkshopWork(
  activeUserId: string | null,
  work: PublishedWork,
): Promise<void> {
  const db = await openWorksDb().catch(() => null);
  if (!db) {
    legacyWriteWork(activeUserId, work);
    return;
  }
  try {
    await putWorkRecord(db, { id: work.id, userId: activeUserId, work });
  } finally {
    db.close();
  }
  // Best-effort offline copy of the generated audio. Fires in the background:
  // a slow R2 fetch must not hold up the "已保存" toast.
  void captureAudioBlob(activeUserId, work).catch(() => {});
}

export async function deleteWorkshopWork(activeUserId: string | null, id: number): Promise<void> {
  const db = await openWorksDb().catch(() => null);
  if (!db) {
    legacyDeleteWork(activeUserId, id);
    return;
  }
  try {
    await deleteWorkRecord(db, id);
    releaseBlobUrl(id);
  } finally {
    db.close();
  }
}

// ---------- legacy localStorage read/write (also the fallback path) ----------

function legacyReadWorks(activeUserId: string | null): PublishedWork[] {
  const storage = getLocalStorage();
  if (!storage) return [];

  const scoped = normalizeStoredPublishedWorks(
    storage.getItem(getWorkshopWorksStorageKey(activeUserId)),
  );
  if (scoped && scoped.length > 0) return scoped;

  // Pre-scoping records live at the bare key.
  return normalizeStoredPublishedWorks(storage.getItem(WORKS_KEY)) ?? [];
}

function legacyWriteWork(activeUserId: string | null, work: PublishedWork): void {
  const storage = getLocalStorage();
  if (!storage) return;
  const next = [work, ...legacyReadWorks(activeUserId).filter((item) => item.id !== work.id)];
  storage.setItem(getWorkshopWorksStorageKey(activeUserId), JSON.stringify(next));
}

function legacyDeleteWork(activeUserId: string | null, id: number): void {
  const storage = getLocalStorage();
  if (!storage) return;
  const next = legacyReadWorks(activeUserId).filter((item) => item.id !== id);
  storage.setItem(getWorkshopWorksStorageKey(activeUserId), JSON.stringify(next));
}

// ---------- audio blob capture + object-URL cache ----------

const blobUrls = new Map<number, string>();

function withBlobUrl(record: WorkRecord): PublishedWork {
  if (!record.audioBlob) return record.work;
  const existing = blobUrls.get(record.id);
  if (existing) return { ...record.work, audio: existing };
  const url = URL.createObjectURL(record.audioBlob);
  blobUrls.set(record.id, url);
  return { ...record.work, audio: url };
}

function releaseBlobUrl(id: number): void {
  const url = blobUrls.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    blobUrls.delete(id);
  }
}

async function captureAudioBlob(activeUserId: string | null, work: PublishedWork): Promise<void> {
  if (!/^https?:\/\//.test(work.audio)) return;
  const response = await fetch(work.audio);
  if (!response.ok) return;
  const blob = await response.blob();
  if (blob.size === 0) return;

  const db = await openWorksDb().catch(() => null);
  if (!db) return;
  try {
    const existing = await getWorkRecord(db, work.id);
    if (existing?.audioBlob) return; // already captured
    await putWorkRecord(db, { id: work.id, userId: activeUserId, work, audioBlob: blob });
  } finally {
    db.close();
  }
}

function getLocalStorage(): Storage | null {
  if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) return null;
  return globalThis.localStorage;
}
