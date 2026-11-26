import { describe, it, expect } from 'vitest';
import { decidePointer, type InputState } from '../../src/ink/input';

const ev = (pointerType: string, isPrimary = true) => ({ pointerType, isPrimary });

describe('decidePointer', () => {
  it('pen always draws', () => {
    const st: InputState = { penSeen: false };
    expect(decidePointer(ev('pen'), st)).toBe('draw');
    expect(st.penSeen).toBe(true);
    expect(decidePointer(ev('pen'), st)).toBe('draw');
  });
  it('touch draws before any pen is seen', () => {
    expect(decidePointer(ev('touch'), { penSeen: false })).toBe('draw');
  });
  it('touch navigates once a pen has been seen', () => {
    const st: InputState = { penSeen: false };
    decidePointer(ev('pen'), st);
    expect(decidePointer(ev('touch'), st)).toBe('navigate');
  });
  it('mouse draws on PC', () => {
    expect(decidePointer(ev('mouse'), { penSeen: true })).toBe('draw');
  });
  it('non-primary touch is ignored for drawing', () => {
    expect(decidePointer(ev('touch', false), { penSeen: false })).not.toBe('draw');
  });
});
