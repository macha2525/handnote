// IndexedDB への保存・読み込み。第2部で同期を差し込む唯一の入口。
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Notebook, Section, Note } from '../model/types';
import { newId } from '../model/ids';

interface HandnoteDB extends DBSchema {
  notebooks: { key: string; value: Notebook };
  sections: { key: string; value: Section; indexes: { notebookId: string } };
  notes: { key: string; value: Note; indexes: { sectionId: string } };
  pdfs: { key: string; value: { id: string; data: ArrayBuffer; type: string } };
}

export class StorageFullError extends Error {
  constructor(cause?: unknown) {
    super('保存できませんでした。iPadの空き容量を確認してください');
    this.name = 'StorageFullError';
    (this as { cause?: unknown }).cause = cause;
  }
}

const DB_NAME = 'handnote';
let dbPromise: Promise<IDBPDatabase<HandnoteDB>> | null = null;

function db(): Promise<IDBPDatabase<HandnoteDB>> {
  if (!dbPromise) {
    dbPromise = openDB<HandnoteDB>(DB_NAME, 1, {
      upgrade(d) {
        d.createObjectStore('notebooks', { keyPath: 'id' });
        d.createObjectStore('sections', { keyPath: 'id' }).createIndex('notebookId', 'notebookId');
        d.createObjectStore('notes', { keyPath: 'id' }).createIndex('sectionId', 'sectionId');
        d.createObjectStore('pdfs', { keyPath: 'id' });
      },
    });
  }
  return dbPromise;
}

function isQuota(e: unknown): boolean {
  return e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22);
}

async function put<S extends 'notebooks' | 'sections' | 'notes' | 'pdfs'>(
  store: S, value: HandnoteDB[S]['value'],
): Promise<void> {
  try {
    const d = await db();
    const tx = d.transaction(store, 'readwrite');
    await Promise.all([tx.store.put(value as never), tx.done]);
  } catch (e) {
    if (isQuota(e) || (e instanceof Error && isQuota((e as { cause?: unknown }).cause))) {
      throw new StorageFullError(e);
    }
    throw e;
  }
}

export async function saveNotebook(n: Notebook): Promise<void> { await put('notebooks', n); }
export async function listNotebooks(): Promise<Notebook[]> {
  const all = await (await db()).getAll('notebooks');
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function saveSection(s: Section): Promise<void> { await put('sections', s); }
export async function listSections(notebookId: string): Promise<Section[]> {
  const all = await (await db()).getAllFromIndex('sections', 'notebookId', notebookId);
  return all.sort((a, b) => a.order - b.order);
}

export async function saveNote(n: Note): Promise<void> { await put('notes', n); }
export async function getNote(id: string): Promise<Note | undefined> { return (await db()).get('notes', id); }
export async function listNotes(sectionId: string): Promise<Note[]> {
  const all = await (await db()).getAllFromIndex('notes', 'sectionId', sectionId);
  return all.sort((a, b) => a.updatedAt - b.updatedAt);
}

export async function putPdf(data: Blob): Promise<string> {
  const id = newId();
  // Blob ではなく ArrayBuffer で保存する（Safari の Blob 保存の不具合を避ける）
  await put('pdfs', { id, data: await blobBytes(data), type: data.type || 'application/pdf' });
  return id;
}
export async function getPdf(id: string): Promise<Blob | undefined> {
  const rec = await (await db()).get('pdfs', id);
  return rec ? new Blob([rec.data], { type: rec.type }) : undefined;
}

function blobBytes(b: Blob): Promise<ArrayBuffer> {
  if (typeof b.arrayBuffer === 'function') return b.arrayBuffer();
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as ArrayBuffer); r.onerror = () => rej(r.error);
    r.readAsArrayBuffer(b);
  });
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) return await navigator.storage.persist();
  } catch { /* 使えない環境 */ }
  return false;
}

/** テスト専用：DBを消して作り直す */
export async function _resetForTests(): Promise<void> {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
  await new Promise<void>((res, rej) => {
    const r = indexedDB.deleteDatabase(DB_NAME);
    r.onsuccess = () => res(); r.onerror = () => rej(r.error); r.onblocked = () => res();
  });
}
