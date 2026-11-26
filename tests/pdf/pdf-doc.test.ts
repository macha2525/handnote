import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createPdfNote, insertBlankPageAfter } from '../../src/pdf/pdf-doc';
import { getPdf, _resetForTests } from '../../src/storage/db';
import type { Note } from '../../src/model/types';

const fixture = () => new Blob([readFileSync(join(process.cwd(), 'tests/fixtures/three-pages.pdf'))], { type: 'application/pdf' });

beforeEach(async () => { await _resetForTests(); });

describe('pdf notes', () => {
  it('createPdfNote makes one page per pdf page with pdf sizes', async () => {
    const note = await createPdfNote('sec1', fixture(), 'スライド');
    expect(note.sectionId).toBe('sec1');
    expect(note.pages.map(p => p.source)).toEqual([
      { type: 'pdf', pdfPage: 1 }, { type: 'pdf', pdfPage: 2 }, { type: 'pdf', pdfPage: 3 },
    ]);
    expect(note.pages.map(p => [p.width, p.height])).toEqual([[595, 842], [612, 792], [595, 842]]);
    expect(note.pdfId).toBeTruthy();
    expect((await getPdf(note.pdfId!))!.size).toBe(fixture().size);
  });

  it('insertBlankPageAfter keeps page order and size', () => {
    const note: Note = {
      id: 'n', sectionId: 's', title: 't', background: 'plain', updatedAt: 0, pdfId: 'x',
      pages: [
        { id: 'a', source: { type: 'pdf', pdfPage: 1 }, width: 595, height: 842, strokes: [] },
        { id: 'b', source: { type: 'pdf', pdfPage: 2 }, width: 612, height: 792, strokes: [] },
      ],
    };
    const out = insertBlankPageAfter(note, 1);
    expect(out.pages.map(p => p.id).slice(0, 2)).toEqual(['a', 'b']);
    expect(out.pages[2].source).toEqual({ type: 'blank' });
    expect([out.pages[2].width, out.pages[2].height]).toEqual([612, 792]);
    const mid = insertBlankPageAfter(note, 0);
    expect(mid.pages.map(p => p.id)[2]).toBe('b');
    expect([mid.pages[1].width, mid.pages[1].height]).toEqual([595, 842]);
    expect(note.pages.length).toBe(2);
  });
});
