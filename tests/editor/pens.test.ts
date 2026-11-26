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

import { HIGHLIGHTER_RACK, PEN_RACK } from '../../src/editor/pens';

describe('highlighter rack', () => {
  it('starts with four highlighters in light colors and thick sizes', () => {
    const hl = parsePens(null, HIGHLIGHTER_RACK);
    expect(hl).toHaveLength(4);
    for (const h of hl) expect(h.size).toBeGreaterThanOrEqual(HIGHLIGHTER_RACK.sizeMin);
    expect(hl[0].color).toBe('#F2D35B');
  });
  it('uses its own size range and step', () => {
    expect(clampSize(3, HIGHLIGHTER_RACK)).toBe(HIGHLIGHTER_RACK.sizeMin);
    expect(clampSize(99, HIGHLIGHTER_RACK)).toBe(HIGHLIGHTER_RACK.sizeMax);
    expect(clampSize(14.4, HIGHLIGHTER_RACK)).toBe(14);
    expect(HIGHLIGHTER_RACK.sizeMin).toBe(6);
    expect(HIGHLIGHTER_RACK.sizeMax).toBe(30);
  });
  it('holds at most six highlighters', () => {
    let hl = parsePens(null, HIGHLIGHTER_RACK);
    for (let i = 0; i < 5; i++) hl = addPen(hl, hl[0], HIGHLIGHTER_RACK);
    expect(hl).toHaveLength(6);
  });
  it('updates with highlighter size rules', () => {
    const hl = parsePens(null, HIGHLIGHTER_RACK);
    expect(updatePen(hl, hl[0].id, { size: 1 }, HIGHLIGHTER_RACK)[0].size).toBe(6);
  });
  it('pen and highlighter racks are stored separately', () => {
    expect(PEN_RACK.key).not.toBe(HIGHLIGHTER_RACK.key);
    expect(PEN_RACK.idKey).not.toBe(HIGHLIGHTER_RACK.idKey);
  });
});
