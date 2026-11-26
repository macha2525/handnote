import { describe, it, expect } from 'vitest';
import { History } from '../../src/ink/history';
import type { Stroke } from '../../src/model/types';

const s = (id: string): Stroke => ({ id, tool: 'pen', color: '#000', size: 2, points: [{ x: 0, y: 0, p: 0.5 }] });

describe('history', () => {
  it('undo of add removes the stroke; redo restores it', () => {
    const h = new History();
    let strokes = [s('a')];
    h.push({ kind: 'add', stroke: strokes[0] });
    strokes = h.undo(strokes);
    expect(strokes).toEqual([]);
    expect(h.canRedo()).toBe(true);
    strokes = h.redo(strokes);
    expect(strokes.map(x => x.id)).toEqual(['a']);
  });
  it('undo of erase restores strokes in their original stacking order', () => {
    const h = new History();
    const all = [s('a'), s('b'), s('c')];
    const piece = s('b2');
    const after = [all[0], all[2], piece];
    h.push({ kind: 'replace', before: all, after });
    expect(h.undo(after).map(x => x.id)).toEqual(['a', 'b', 'c']);
    expect(h.redo(all).map(x => x.id)).toEqual(['a', 'c', 'b2']);
  });
  it('new op clears redo', () => {
    const h = new History();
    let strokes = [s('a')];
    h.push({ kind: 'add', stroke: strokes[0] });
    strokes = h.undo(strokes);
    h.push({ kind: 'add', stroke: s('b') });
    expect(h.canRedo()).toBe(false);
  });
  it('keeps at most 200 steps', () => {
    const h = new History();
    for (let i = 0; i < 250; i++) h.push({ kind: 'add', stroke: s('x' + i) });
    let n = 0; let strokes: Stroke[] = [];
    while (h.canUndo()) { strokes = h.undo(strokes); n++; }
    expect(n).toBe(200);
  });
});
