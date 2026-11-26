import { describe, it, expect } from 'vitest';
import { TapGesture } from '../../src/editor/tap-gesture';

const f = (id: number, x = 100, y = 100, stylus = false) => ({ id, x, y, stylus });

describe('TapGesture', () => {
  it('two-finger tap → undo', () => {
    const g = new TapGesture();
    g.start([f(1), f(2, 160)], 0);
    expect(g.end([1, 2], 120)).toBe('undo');
  });

  it('three-finger tap → redo, even if fingers land and lift a bit apart', () => {
    const g = new TapGesture();
    g.start([f(1)], 0);
    g.start([f(2, 150), f(3, 200)], 40);
    expect(g.end([1], 150)).toBeNull();
    expect(g.end([2, 3], 180)).toBe('redo');
  });

  it('moving fingers (scroll / pinch) is not a tap', () => {
    const g = new TapGesture();
    g.start([f(1), f(2, 160)], 0);
    g.move([f(1, 100, 130)]);
    expect(g.end([1, 2], 150)).toBeNull();
  });

  it('small jitter is still a tap', () => {
    const g = new TapGesture();
    g.start([f(1), f(2, 160)], 0);
    g.move([f(1, 104, 103), f(2, 157, 98)]);
    expect(g.end([1, 2], 150)).toBe('undo');
  });

  it('holding too long is not a tap', () => {
    const g = new TapGesture();
    g.start([f(1), f(2, 160)], 0);
    expect(g.end([1, 2], 900)).toBeNull();
  });

  it('one finger is not a gesture', () => {
    const g = new TapGesture();
    g.start([f(1)], 0);
    expect(g.end([1], 80)).toBeNull();
  });

  it('anything involving the Pencil is never a tap (palm + pen dot)', () => {
    const g = new TapGesture();
    g.start([f(1), f(2, 300, 300, true)], 0);
    expect(g.end([1, 2], 100)).toBeNull();
  });

  it('cancel aborts', () => {
    const g = new TapGesture();
    g.start([f(1), f(2, 160)], 0);
    g.cancel();
    expect(g.end([1, 2], 100)).toBeNull();
  });

  it('starts fresh for the next gesture', () => {
    const g = new TapGesture();
    g.start([f(1), f(2, 160)], 0);
    g.move([f(1, 100, 200)]);
    g.end([1, 2], 100);
    g.start([f(3), f(4, 160)], 1000);
    expect(g.end([3, 4], 1100)).toBe('undo');
  });
});

describe('TapGesture double tap', () => {
  it('two quick one-finger taps → doubleTap', () => {
    const g = new TapGesture();
    g.start([f(1)], 0);
    expect(g.end([1], 80)).toBeNull();
    g.start([f(2, 105, 98)], 200);
    expect(g.end([2], 270)).toBe('doubleTap');
  });

  it('a third tap starts over (no double-double)', () => {
    const g = new TapGesture();
    g.start([f(1)], 0); g.end([1], 60);
    g.start([f(2)], 150); expect(g.end([2], 210)).toBe('doubleTap');
    g.start([f(3)], 300); expect(g.end([3], 360)).toBeNull();
  });

  it('too slow or too far apart is not a double tap', () => {
    const g = new TapGesture();
    g.start([f(1)], 0); g.end([1], 60);
    g.start([f(2)], 600); expect(g.end([2], 660)).toBeNull();
    const h = new TapGesture();
    h.start([f(1)], 0); h.end([1], 60);
    h.start([f(2, 300, 100)], 150); expect(h.end([2], 210)).toBeNull();
  });

  it('a scroll in between breaks it', () => {
    const g = new TapGesture();
    g.start([f(1)], 0); g.end([1], 60);
    g.start([f(2)], 120); g.move([f(2, 100, 160)]); g.end([2], 180);
    g.start([f(3)], 240); expect(g.end([3], 300)).toBeNull();
  });

  it('Pencil taps never count', () => {
    const g = new TapGesture();
    g.start([f(1, 100, 100, true)], 0); g.end([1], 60);
    g.start([f(2, 100, 100, true)], 150); expect(g.end([2], 210)).toBeNull();
  });
});
