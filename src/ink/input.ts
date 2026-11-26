import type { StrokePoint } from '../model/types';
import { toPage } from './geometry';

export interface InputState { penSeen: boolean; }

/**
 * ペンは常に描く。一度ペンを検知したら、指はスクロール・拡大に使う。
 * ペンを使う前は指1本で描ける。2本目以降の指は描かない（拡大用）。
 */
export function decidePointer(
  e: { pointerType: string; isPrimary: boolean }, state: InputState,
): 'draw' | 'navigate' | 'ignore' {
  switch (e.pointerType) {
    case 'pen':
      state.penSeen = true;
      return 'draw';
    case 'mouse':
      return 'draw';
    case 'touch':
      if (!e.isPrimary) return 'navigate';
      return state.penSeen ? 'navigate' : 'draw';
    default:
      return 'ignore';
  }
}

// 拡大・縮小は編集画面が自分で行う（ブラウザに任せると道具バーごと拡大される）
const NAV_TOUCH_ACTION = 'pan-x pan-y';
/** 指で書き始めてから、この時間内に2本目の指が来たら線を捨てる（ms） */
const CANCEL_WINDOW_MS = 350;
/** 同じ状態を共有するページ。ペンを検知したら全部まとめてスクロール用に切り替える */
const attached = new WeakMap<InputState, Set<HTMLElement>>();

export function attachInkInput(el: HTMLElement, opts: {
  getScale(): number;
  onStrokeStart(p: StrokePoint): void;
  onStrokeMove(p: StrokePoint): void;
  onStrokeEnd(): void;
  /** 書き始めてすぐ指が増えた（2本指タップや拡大）。書きかけの線は捨てる */
  onStrokeCancel?(): void;
  /** 画面全体で共有する状態（ページをまたいでもペン検知を引き継ぐ） */
  state?: InputState;
}): () => void {
  const state = opts.state ?? { penSeen: false };
  let active: number | null = null;
  let activeType = '';
  let activeSince = 0;
  el.style.touchAction = state.penSeen ? NAV_TOUCH_ACTION : 'none';
  if (!attached.has(state)) attached.set(state, new Set());
  const group = attached.get(state)!;
  group.add(el);

  const point = (e: PointerEvent): StrokePoint => {
    const r = el.getBoundingClientRect();
    const p = e.pointerType === 'mouse' || e.pressure === 0 ? 0.5 : e.pressure;
    return toPage(e.clientX - r.left, e.clientY - r.top, opts.getScale(), p);
  };
  const end = () => {
    if (active === null) return;
    active = null;
    opts.onStrokeEnd();
  };

  /** 指で書き始めたばかりなら線を捨てる。捨てたら true */
  const cancelIfRecent = (now: number): boolean => {
    if (active === null || activeType !== 'touch' || !opts.onStrokeCancel) return false;
    if (now - activeSince >= CANCEL_WINDOW_MS) return false;
    active = null;
    opts.onStrokeCancel();
    return true;
  };
  // 2本目の指がページの外（余白など）に触れたときも気づけるよう、画面全体で見る
  const anyTouch = (e: TouchEvent) => {
    const fingers = Array.from(e.touches).filter(t => (t as Touch & { touchType?: string }).touchType !== 'stylus');
    if (fingers.length >= 2 && !cancelIfRecent(e.timeStamp) && active !== null && activeType === 'touch') end();
  };

  const down = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const d = decidePointer(e, state);
    if (state.penSeen) for (const g of group) g.style.touchAction = NAV_TOUCH_ACTION;
    if (d !== 'draw') {
      // 指で書いている最中に2本目の指が来たら、拡大とみなして線を終える。
      // 書き始めてすぐなら、2本指タップの1本目だったとみなして線を捨てる
      if (active !== null && e.pointerType === 'touch' && activeType === 'touch') {
        if (!cancelIfRecent(e.timeStamp)) end();
      }
      return;
    }
    if (active !== null) return;
    active = e.pointerId;
    activeType = e.pointerType;
    activeSince = e.timeStamp;
    try { el.setPointerCapture(e.pointerId); } catch { /* jsdom など */ }
    e.preventDefault();
    opts.onStrokeStart(point(e));
  };
  const move = (e: PointerEvent) => {
    if (e.pointerId !== active) return;
    e.preventDefault();
    const evs = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    for (const c of evs.length ? evs : [e]) opts.onStrokeMove(point(c));
  };
  const up = (e: PointerEvent) => { if (e.pointerId === active) end(); };

  // iPadのSafariでは、touch-action が pan でもペンがスクロールしてしまうので、ペンのタッチだけ止める
  const touchStart = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if ((t as Touch & { touchType?: string }).touchType === 'stylus') { e.preventDefault(); return; }
    }
  };

  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('touchstart', touchStart, { passive: false });
  el.addEventListener('touchmove', touchStart, { passive: false });
  window.addEventListener('touchstart', anyTouch, { capture: true, passive: true });
  return () => {
    window.removeEventListener('touchstart', anyTouch, { capture: true });
    group.delete(el);
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', up);
    el.removeEventListener('touchstart', touchStart);
    el.removeEventListener('touchmove', touchStart);
  };
}
