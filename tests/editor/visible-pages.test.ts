import { describe, it, expect } from 'vitest';
import { visiblePageRange } from '../../src/pdf/pdf-doc';

function stack(n: number, h = 1000, gap = 16) {
  const tops: number[] = [], heights: number[] = [];
  let y = gap;
  for (let i = 0; i < n; i++) { tops.push(y); heights.push(h); y += h + gap; }
  return { tops, heights };
}

describe('visiblePageRange', () => {
  it('visiblePageRange includes one page before and after', () => {
    const { tops, heights } = stack(10);
    // 4ページ目(index 3)だけが見えている
    expect(visiblePageRange(tops[3] + 10, 500, tops, heights)).toEqual([2, 4]);
    expect(visiblePageRange(0, 500, tops, heights)).toEqual([0, 1]);
    expect(visiblePageRange(tops[9], 2000, tops, heights)).toEqual([8, 9]);
  });
  it('visiblePageRange on a 300-page document returns a small range', () => {
    const { tops, heights } = stack(300);
    for (const st of [0, 50_000, 150_000, tops[299]]) {
      const [a, b] = visiblePageRange(st, 1200, tops, heights);
      expect(b - a + 1).toBeLessThanOrEqual(5);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(300);
    }
  });
});
