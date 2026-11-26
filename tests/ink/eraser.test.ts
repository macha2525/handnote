import { describe, it, expect } from 'vitest';
import { strokeHit, eraseAt } from '../../src/ink/eraser';
import type { Stroke } from '../../src/model/types';

const mk = (id: string, y: number): Stroke => ({
  id, tool: 'pen', color: '#000', size: 2,
  points: [{ x: 0, y, p: 0.5 }, { x: 100, y, p: 0.5 }],
});

describe('eraser', () => {
  it('strokeHit true near a segment, false far away', () => {
    const s = mk('a', 50);
    expect(strokeHit(s, { x: 50, y: 55 }, 5)).toBe(true);
    expect(strokeHit(s, { x: 50, y: 80 }, 5)).toBe(false);
    expect(strokeHit(s, { x: 130, y: 50 }, 5)).toBe(false);
  });
  it('eraseAt removes whole strokes only', () => {
    const strokes = [mk('a', 10), mk('b', 50), mk('c', 90)];
    const before = JSON.stringify(strokes);
    const { kept, removed } = eraseAt(strokes, { x: 50, y: 51 }, 3);
    expect(kept.map(s => s.id)).toEqual(['a', 'c']);
    expect(removed.map(s => s.id)).toEqual(['b']);
    expect(JSON.stringify(strokes)).toBe(before);
    expect(kept[0].points).toEqual(strokes[0].points);
  });
});
