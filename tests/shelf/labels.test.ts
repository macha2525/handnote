import { describe, it, expect } from 'vitest';
import { nextSectionLabel, NOTEBOOK_COLORS, spineTone } from '../../src/shelf/labels';
import type { Section } from '../../src/model/types';

const sec = (order: number): Section => ({ id: 's' + order, notebookId: 'n', order, label: '' });

function lum(hex: string): number {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe('labels', () => {
  it('lecture notebooks number sessions as 第n回', () => {
    expect(nextSectionLabel('lecture', [])).toEqual({ order: 1, label: '第1回' });
    expect(nextSectionLabel('lecture', [sec(1)])).toEqual({ order: 2, label: '第2回' });
  });
  it('qualification notebooks number chapters as 第n章', () => {
    expect(nextSectionLabel('qualification', [sec(1), sec(2)])).toEqual({ order: 3, label: '第3章' });
  });
  it('next label follows the highest existing order even with gaps', () => {
    expect(nextSectionLabel('lecture', [sec(1), sec(5), sec(2)])).toEqual({ order: 6, label: '第6回' });
  });
  it('notebook colors meet 4.5:1 contrast with their label text', () => {
    expect(NOTEBOOK_COLORS).toHaveLength(5);
    for (const c of NOTEBOOK_COLORS) {
      const t = spineTone(c.bg);
      expect(t.bg).toBe(c.bg);
      expect(contrast(t.bg, t.text)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('old notebook colors are read as the new ones', () => {
    const newBgs = NOTEBOOK_COLORS.map(c => c.bg);
    for (const old of ['#1F2330', '#C8334A', '#8FA7C9', '#F2D35B', '#E3E7EE']) {
      expect(newBgs).toContain(spineTone(old).bg);
    }
    expect(spineTone('#1F2330').bg).toBe('#2E4B8A');
    expect(spineTone('#c8334a').bg).toBe('#8A3A45');
  });
  it('unknown colors still get readable text', () => {
    const t = spineTone('#123456');
    expect(contrast(t.bg, t.text)).toBeGreaterThanOrEqual(4.5);
  });
});
