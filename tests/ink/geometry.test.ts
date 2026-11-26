import { describe, it, expect } from 'vitest';
import { strokeOutline, toScreen, toPage } from '../../src/ink/geometry';
import type { Stroke, InkTool } from '../../src/model/types';

function line(p: number, tool: InkTool = 'pen'): Stroke {
  const points = Array.from({ length: 20 }, (_, i) => ({ x: i * 5, y: 50, p }));
  return { id: 's', tool, color: '#000', size: tool === 'pen' ? 4 : 14, points };
}
function width(outline: [number, number][]): number {
  const ys = outline.map(p => p[1]);
  const xs = outline.map(p => p[0]);
  return Math.min(Math.max(...ys) - Math.min(...ys), Math.max(...xs) - Math.min(...xs));
}

describe('geometry', () => {
  it('higher pressure makes a wider outline', () => {
    expect(width(strokeOutline(line(0.9)))).toBeGreaterThan(width(strokeOutline(line(0.2))));
  });
  it('highlighter ignores pressure', () => {
    const a = width(strokeOutline(line(0.2, 'highlighter')));
    const b = width(strokeOutline(line(0.9, 'highlighter')));
    expect(Math.abs(a - b)).toBeLessThan(1);
  });
  it('page/screen conversion round-trips at any zoom', () => {
    const pt = { x: 123.4, y: 567.8, p: 0.42 };
    for (const scale of [0.5, 1, 2.75]) {
      const s = toScreen(pt, scale);
      const back = toPage(s.x, s.y, scale, pt.p);
      expect(back.x).toBeCloseTo(pt.x, 9);
      expect(back.y).toBeCloseTo(pt.y, 9);
      expect(back.p).toBe(pt.p);
    }
  });
});
