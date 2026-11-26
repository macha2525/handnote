import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveNotebook, listNotebooks, saveSection, listSections, saveNote, getNote, listNotes,
  putPdf, getPdf, deleteNote, deleteSection, deleteNotebook, _resetForTests,
} from '../../src/storage/db';
import type { Note } from '../../src/model/types';

const note = (id: string, sectionId: string, pdfId?: string): Note =>
  ({ id, sectionId, title: id, background: 'plain', pdfId, pages: [], updatedAt: 1 });

beforeEach(async () => {
  await _resetForTests();
  await saveNotebook({ id: 'nb1', title: 'A', color: '#1F2330', kind: 'lecture', createdAt: 1 });
  await saveNotebook({ id: 'nb2', title: 'B', color: '#1F2330', kind: 'lecture', createdAt: 2 });
  await saveSection({ id: 's1', notebookId: 'nb1', order: 1, label: '第1回' });
  await saveSection({ id: 's2', notebookId: 'nb1', order: 2, label: '第2回' });
  await saveSection({ id: 'x1', notebookId: 'nb2', order: 1, label: '第1回' });
});

describe('delete', () => {
  it('deleteNote removes the note and its pdf, leaving siblings', async () => {
    const pdfId = await putPdf(new Blob([new Uint8Array([1, 2, 3])]));
    await saveNote(note('n1', 's1', pdfId));
    await saveNote(note('n2', 's1'));
    await deleteNote('n1');
    expect(await getNote('n1')).toBeUndefined();
    expect(await getPdf(pdfId)).toBeUndefined();
    expect((await listNotes('s1')).map(n => n.id)).toEqual(['n2']);
  });

  it('deleteSection removes the section and all its notes', async () => {
    await saveNote(note('n1', 's1'));
    await saveNote(note('n2', 's2'));
    await deleteSection('s1');
    expect((await listSections('nb1')).map(s => s.id)).toEqual(['s2']);
    expect(await getNote('n1')).toBeUndefined();
    expect(await getNote('n2')).toBeDefined();
  });

  it('deleteNotebook removes everything inside it only', async () => {
    const pdfId = await putPdf(new Blob([new Uint8Array([9])]));
    await saveNote(note('n1', 's1', pdfId));
    await saveNote(note('n2', 's2'));
    await saveNote(note('y1', 'x1'));
    await deleteNotebook('nb1');
    expect((await listNotebooks()).map(n => n.id)).toEqual(['nb2']);
    expect(await listSections('nb1')).toEqual([]);
    expect(await getNote('n1')).toBeUndefined();
    expect(await getNote('n2')).toBeUndefined();
    expect(await getPdf(pdfId)).toBeUndefined();
    expect(await getNote('y1')).toBeDefined();
    expect((await listSections('nb2')).map(s => s.id)).toEqual(['x1']);
  });

  it('deleting something missing is a no-op', async () => {
    await expect(deleteNote('nope')).resolves.toBeUndefined();
    await expect(deleteSection('nope')).resolves.toBeUndefined();
    await expect(deleteNotebook('nope')).resolves.toBeUndefined();
  });
});
