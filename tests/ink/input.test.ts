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

describe('attachInkInput touch-action', () => {
  function down(el: HTMLElement, pointerType: string) {
    const e = new Event('pointerdown', { bubbles: true, cancelable: true }) as Event & Record<string, unknown>;
    Object.assign(e, { pointerType, isPrimary: true, pointerId: 1, button: 0, clientX: 0, clientY: 0, pressure: 0.5 });
    el.dispatchEvent(e);
  }
  const noop = { getScale: () => 1, onStrokeStart() {}, onStrokeMove() {}, onStrokeEnd() {} };

  it('switches every attached page to scrolling once a pen is seen', async () => {
    const { attachInkInput } = await import('../../src/ink/input');
    const state: InputState = { penSeen: false };
    const a = document.createElement('div'), b = document.createElement('div');
    attachInkInput(a, { ...noop, state });
    attachInkInput(b, { ...noop, state });
    expect(b.style.touchAction).toBe('none');
    down(a, 'pen');
    expect(a.style.touchAction).toBe('pan-x pan-y');
    expect(b.style.touchAction).toBe('pan-x pan-y');
  });
});

describe('finger stroke vs second finger', () => {
  function ev(el: HTMLElement, type: string, o: Record<string, unknown>) {
    const e = new Event(type, { bubbles: true, cancelable: true }) as Event & Record<string, unknown>;
    Object.defineProperty(e, 'timeStamp', { value: o.t });
    Object.assign(e, { pointerType: 'touch', button: 0, clientX: 0, clientY: 0, pressure: 0.5, ...o });
    el.dispatchEvent(e);
  }
  async function setup() {
    const { attachInkInput } = await import('../../src/ink/input');
    const log: string[] = [];
    const el = document.createElement('div');
    attachInkInput(el, {
      getScale: () => 1, state: { penSeen: false },
      onStrokeStart() { log.push('start'); }, onStrokeMove() {},
      onStrokeEnd() { log.push('end'); }, onStrokeCancel() { log.push('cancel'); },
    });
    return { el, log };
  }

  it('a quick second finger discards the stroke (two-finger tap)', async () => {
    const { el, log } = await setup();
    ev(el, 'pointerdown', { pointerId: 1, isPrimary: true, t: 1000 });
    ev(el, 'pointerdown', { pointerId: 2, isPrimary: false, t: 1060 });
    ev(el, 'pointerup', { pointerId: 1, t: 1120 });
    expect(log).toEqual(['start', 'cancel']);
  });

  it('a late second finger keeps the stroke (pinch while writing)', async () => {
    const { el, log } = await setup();
    ev(el, 'pointerdown', { pointerId: 1, isPrimary: true, t: 1000 });
    ev(el, 'pointerdown', { pointerId: 2, isPrimary: false, t: 1800 });
    expect(log).toEqual(['start', 'end']);
  });

  it('a quick second finger off the page (margin) also discards the stroke', async () => {
    const { el, log } = await setup();
    ev(el, 'pointerdown', { pointerId: 1, isPrimary: true, t: 1000 });
    const te = new Event('touchstart', { bubbles: true });
    Object.defineProperty(te, 'timeStamp', { value: 1050 });
    Object.assign(te, { touches: [{ identifier: 1 }, { identifier: 2 }] });
    document.body.dispatchEvent(te);
    ev(el, 'pointerup', { pointerId: 1, t: 1100 });
    expect(log).toEqual(['start', 'cancel']);
  });
});
