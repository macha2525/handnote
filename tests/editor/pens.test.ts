import { describe, it, expect } from 'vitest';
import { addPen, clampSize, defaultPens, MAX_PENS, parsePens, removePen, updatePen } from '../../src/editor/pens';

describe('pens', () => {
  it('starts with four pens', () => {
    expect(parsePens(null)).toHaveLength(4);
  });
  it('falls back to defaults on broken data', () => {
    expect(parsePens('not json')).toEqual(defaultPens());
    expect(parsePens('{"a":1}')).toEqual(defaultPens());
    expect(parsePens('[]')).toEqual(defaultPens());
  });
  it('drops invalid entries and clamps sizes', () => {
    const raw = JSON.stringify([
      { id: 'a', color: '#112233', size: 100 },
      { id: 'b', color: 'red', size: 2 },
      { id: 'c', color: '#445566', size: 0.1 },
    ]);
    expect(parsePens(raw)).toEqual([
      { id: 'a', color: '#112233', size: 8 },
      { id: 'c', color: '#445566', size: 0.5 },
    ]);
  });
  it('rounds size to the slider step', () => {
    expect(clampSize(1.6)).toBe(1.5);
    expect(clampSize(1.9)).toBe(2);
    expect(clampSize(NaN)).toBe(2.5);
  });
  it('adds a copy of the current pen up to the limit', () => {
    let pens = defaultPens();
    pens = addPen(pens, pens[2]);
    expect(pens).toHaveLength(5);
    expect(pens[4].color).toBe(pens[2].color);
    expect(pens[4].id).not.toBe(pens[2].id);
    while (pens.length < MAX_PENS) pens = addPen(pens, pens[0]);
    expect(addPen(pens, pens[0])).toHaveLength(MAX_PENS);
  });
  it('removes a pen but always keeps one', () => {
    const pens = defaultPens();
    expect(removePen(pens, 'p2').map(p => p.id)).toEqual(['p1', 'p3', 'p4']);
    expect(removePen([pens[0]], 'p1')).toHaveLength(1);
  });
  it('updates color and size with validation', () => {
    const pens = defaultPens();
    const out = updatePen(pens, 'p1', { color: '#ABCDEF', size: 3.1 });
    expect(out[0]).toEqual({ id: 'p1', color: '#ABCDEF', size: 3 });
    expect(updatePen(pens, 'p1', { color: 'bad' })[0].color).toBe(pens[0].color);
    expect(out[1]).toBe(pens[1]);
  });
});
