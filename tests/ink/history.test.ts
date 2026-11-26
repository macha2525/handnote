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
  it('undo of erase restores removed strokes', () => {
    const h = new History();
    const all = [s('a'), s('b'), s('c')];
    h.push({ kind: 'remove', strokes: [all[1]] });
    const after = h.undo([all[0], all[2]]);
    expect(after.map(x => x.id).sort()).toEqual(['a', 'b', 'c']);
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
