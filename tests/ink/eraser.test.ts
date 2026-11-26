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

import { erasePartAt } from '../../src/ink/eraser';

describe('partial eraser', () => {
  const long = (): Stroke => ({
    id: 'L', tool: 'pen', color: '#123', size: 2,
    points: Array.from({ length: 11 }, (_, i) => ({ x: i * 10, y: 50, p: 0.4 })),
  });

  it('cuts a hole in the middle, leaving two pieces in the same place in the stack', () => {
    const strokes = [mk('a', 10), long(), mk('c', 90)];
    const { strokes: out, changed } = erasePartAt(strokes, { x: 50, y: 50 }, 5);
    expect(changed).toBe(true);
    expect(out[0].id).toBe('a');
    expect(out[out.length - 1].id).toBe('c');
    const pieces = out.slice(1, -1);
    expect(pieces).toHaveLength(2);
    const [left, right] = pieces;
    expect(left.color).toBe('#123');
    expect(left.size).toBe(2);
    expect(Math.max(...left.points.map(p => p.x))).toBeLessThanOrEqual(50 - 5);
    expect(Math.min(...right.points.map(p => p.x))).toBeGreaterThanOrEqual(50 + 5);
    expect(left.points[0].x).toBe(0);
    expect(right.points[right.points.length - 1].x).toBe(100);
    expect(left.id).not.toBe(right.id);
  });

  it('cuts sparse segments that pass through the eraser even with no point inside', () => {
    const s: Stroke = { id: 's', tool: 'pen', color: '#000', size: 1, points: [{ x: 0, y: 0, p: 0.5 }, { x: 100, y: 0, p: 0.5 }] };
    const { strokes: out } = erasePartAt([s], { x: 50, y: 0 }, 4);
    expect(out).toHaveLength(2);
    expect(out[0].points[out[0].points.length - 1].x).toBeCloseTo(50 - 4.5, 5);
    expect(out[1].points[0].x).toBeCloseTo(50 + 4.5, 5);
  });

  it('trims an end without splitting', () => {
    const { strokes: out } = erasePartAt([long()], { x: 0, y: 50 }, 5);
    expect(out).toHaveLength(1);
    expect(out[0].points[0].x).toBeGreaterThanOrEqual(5);
  });

  it('removes a stroke entirely when everything is inside', () => {
    const dot: Stroke = { id: 'd', tool: 'pen', color: '#000', size: 2, points: [{ x: 50, y: 50, p: 0.5 }] };
    const { strokes: out, changed } = erasePartAt([dot], { x: 51, y: 50 }, 5);
    expect(changed).toBe(true);
    expect(out).toEqual([]);
  });

  it('leaves untouched strokes as the same objects and reports no change', () => {
    const strokes = [mk('a', 10)];
    const { strokes: out, changed } = erasePartAt(strokes, { x: 50, y: 80 }, 5);
    expect(changed).toBe(false);
    expect(out[0]).toBe(strokes[0]);
  });
});
