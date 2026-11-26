import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveNotebook, listNotebooks, saveSection, listSections, saveNote, getNote,
  putPdf, getPdf, StorageFullError, _resetForTests,
} from '../../src/storage/db';
import type { Notebook, Note } from '../../src/model/types';

const nb = (id: string, createdAt: number): Notebook =>
  ({ id, title: 't' + id, color: '#1F2330', kind: 'lecture', createdAt });

beforeEach(async () => {
  await _resetForTests();
});

describe('db', () => {
  it('saves and lists notebooks in creation order', async () => {
    await saveNotebook({ ...nb('b', 2), title: 'second' });
    await saveNotebook({ ...nb('a', 1), title: 'first' });
    expect((await listNotebooks()).map(n => n.title)).toEqual(['first', 'second']);
  });

  it('lists sections of one notebook ordered by order', async () => {
    await saveSection({ id: 's2', notebookId: 'n1', order: 2, label: '第2回' });
    await saveSection({ id: 's1', notebookId: 'n1', order: 1, label: '第1回' });
    await saveSection({ id: 'x', notebookId: 'n2', order: 1, label: '第1章' });
    expect((await listSections('n1')).map(s => s.id)).toEqual(['s1', 's2']);
  });

  it('round-trips a note with strokes', async () => {
    const points = [{ x: 1, y: 2, p: 0.5 }, { x: 3.5, y: 4.25, p: 0.9 }];
    const note: Note = {
      id: 'note1', sectionId: 's1', title: 'n', background: 'ruled', updatedAt: 1,
      pages: [{ id: 'p1', source: { type: 'blank' }, width: 595, height: 842,
        strokes: [{ id: 'st', tool: 'pen', color: '#1F2330', size: 2.5, points }] }],
    };
    await saveNote(note);
    const back = await getNote('note1');
    expect(back!.pages[0].strokes[0].points).toEqual(points);
  });

  it('stores and returns a pdf blob', async () => {
    const blob = new Blob([new Uint8Array(1234)], { type: 'application/pdf' });
    const id = await putPdf(blob);
    const back = await getPdf(id);
    expect(back!.size).toBe(1234);
  });

  it('has no limit on notebook count', async () => {
    for (let i = 0; i < 1000; i++) await saveNotebook(nb('n' + i, i));
    expect((await listNotebooks()).length).toBe(1000);
  });

  it('wraps quota errors in StorageFullError', async () => {
    const spy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw new DOMException('', 'QuotaExceededError');
    });
    const note: Note = { id: 'q', sectionId: 's', title: 'q', background: 'plain', pages: [], updatedAt: 0 };
    await expect(saveNote(note)).rejects.toBeInstanceOf(StorageFullError);
    spy.mockRestore();
  });
});
