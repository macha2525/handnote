import { describe, it, expect } from 'vitest';
import { cleanPoints } from '../../src/ink/smooth';
import type { StrokePoint } from '../../src/model/types';

const sd = (xs: number[]) => {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
};

describe('cleanPoints', () => {
  it('replaces a zero-pressure first point with the next real pressure', () => {
    const out = cleanPoints([{ x: 0, y: 0, p: 0 }, { x: 5, y: 0, p: 0.6 }, { x: 10, y: 0, p: 0.6 }]);
    expect(out[0].p).toBeCloseTo(0.6, 5);
  });

  it('falls back to medium pressure when the device reports none', () => {
    const out = cleanPoints([{ x: 0, y: 0, p: 0 }, { x: 5, y: 0, p: 0 }, { x: 10, y: 0, p: 0 }]);
    for (const pt of out) expect(pt.p).toBe(0.5);
  });

  it('smooths noisy pressure', () => {
    const pts: StrokePoint[] = Array.from({ length: 80 }, (_, i) => ({ x: i * 2, y: 0, p: 0.5 + (i % 2 ? 0.15 : -0.15) }));
    const out = cleanPoints(pts);
    expect(sd(out.slice(10).map(p => p.p))).toBeLessThan(sd(pts.slice(10).map(p => p.p)) / 3);
  });

  it('drops points that barely moved', () => {
    const pts: StrokePoint[] = [];
    for (let i = 0; i < 50; i++) pts.push({ x: i * 0.05, y: 0, p: 0.5 });
    pts.push({ x: 10, y: 0, p: 0.5 });
    expect(cleanPoints(pts).length).toBeLessThan(15);
  });

  it('keeps the end blunt when the pen stops before lifting (tome)', () => {
    const pts: StrokePoint[] = Array.from({ length: 30 }, (_, i) => ({ x: i * 3, y: 0, p: 0.6 }));
    for (let i = 0; i < 12; i++) pts.push({ x: 87 + (i % 2) * 0.3, y: (i % 3) * 0.2, p: 0.6 * (1 - i / 12) });
    const out = cleanPoints(pts);
    expect(out[out.length - 1].p).toBeGreaterThan(0.45);
  });

  it('keeps the taper when the pen lifts while moving (harai)', () => {
    const pts: StrokePoint[] = Array.from({ length: 40 }, (_, i) => ({ x: i * 3, y: i, p: 0.6 * (1 - i / 40) + 0.02 }));
    const out = cleanPoints(pts);
    expect(out[out.length - 1].p).toBeLessThan(0.15);
  });

  it('handles tiny strokes (a dot)', () => {
    expect(cleanPoints([{ x: 1, y: 1, p: 0.4 }]).length).toBe(1);
    expect(cleanPoints([]).length).toBe(0);
  });

  it('a press when landing or stopping does not leave a dot fatter than the line', () => {
    const pts: StrokePoint[] = [];
    for (const p of [0.2, 0.45, 0.6, 0.55, 0.45]) pts.push({ x: 0.2, y: 0.1, p });   // 着地で押し込む
    for (let i = 1; i <= 30; i++) pts.push({ x: i * 3, y: 0, p: 0.3 });               // 軽い筆圧で書く
    for (const p of [0.45, 0.6, 0.4, 0.15]) pts.push({ x: 90.3, y: 0.2, p });          // 止めで押し込む
    const out = cleanPoints(pts);
    expect(out[0].p).toBeLessThan(0.36);
    expect(out[out.length - 1].p).toBeLessThan(0.36);
    expect(out[out.length - 1].p).toBeGreaterThan(0.25); // 細くしぼみもしない（止めは止めのまま）
  });
});
