// Minimal, dependency-free IndexedDB wrapper for the local works library.
//
// Why IndexedDB instead of localStorage:
//   * localStorage caps around 5MB and every write is a synchronous
//     main-thread block — a generated WAV is ~10MB and won't fit.
//   * IndexedDB stores structured clones natively, so a work's audio Blob can
//     live right next to its metadata and play back offline.
//
// The wrapper mirrors the async works API in storage.ts 1:1; storage.ts owns
// the legacy localStorage migration and the read-through fallback.

import type { PublishedWork } from './works.ts';

const DB_NAME = 'jiu-works-db';
const DB_VERSION = 1;
const STORE = 'works';

export interface WorkRecord {
  /** IndexedDB keyPath — the PublishedWork.id. */
  id: number;
  /** Owner: device UUID (null for pre-scoping records). */
  userId: string | null;
  work: PublishedWork;
  /** Captured audio for offline playback; absent when capture failed. */
  audioBlob?: Blob;
}

export async function openWorksDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return null;
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('indexedDB open failed'));
  });
}

export async function getAllWorkRecords(db: IDBDatabase): Promise<WorkRecord[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result as WorkRecord[]);
    request.onerror = () => reject(request.error ?? new Error('indexedDB getAll failed'));
  });
}

export async function getWorkRecord(db: IDBDatabase, id: number): Promise<WorkRecord | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(id);
    request.onsuccess = () => resolve(request.result as WorkRecord | undefined);
    request.onerror = () => reject(request.error ?? new Error('indexedDB get failed'));
  });
}

export async function putWorkRecord(db: IDBDatabase, record: WorkRecord): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('indexedDB put failed'));
    tx.onabort = () => reject(tx.error ?? new Error('indexedDB put aborted'));
  });
}

export async function deleteWorkRecord(db: IDBDatabase, id: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('indexedDB delete failed'));
    tx.onabort = () => reject(tx.error ?? new Error('indexedDB delete aborted'));
  });
}
