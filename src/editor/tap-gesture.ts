/** 指のタップで元に戻す（2本）・やり直す（3本）。動かしたり長く押したりしたら、スクロールや拡大とみなす */
export interface TapTouch { id: number; x: number; y: number; stylus: boolean; }

/** これ以上動いたらタップではない（px） */
const MOVE_LIMIT = 12;
/** 最初の指が触れてから、全部離れるまでの上限（ms） */
const TIME_LIMIT = 350;
/** ダブルタップ：1回目が離れてから2回目が触れるまで（ms）と、2回のずれ（px） */
const DOUBLE_GAP = 300;
const DOUBLE_DIST = 40;

export type TapResult = 'undo' | 'redo' | 'doubleTap';

export class TapGesture {
  private active = new Map<number, { x: number; y: number }>();
  private max = 0;
  private startTime = 0;
  private failed = false;
  private first: { x: number; y: number } | null = null;
  /** 直前の、指1本のタップ（ダブルタップの1回目の候補） */
  private lastTap: { t: number; x: number; y: number } | null = null;

  start(touches: TapTouch[], t: number): void {
    if (this.active.size === 0) {
      this.max = 0; this.startTime = t; this.failed = false;
      this.first = touches[0] ? { x: touches[0].x, y: touches[0].y } : null;
      if (this.lastTap && t - this.lastTap.t > DOUBLE_GAP) this.lastTap = null;
    }
    for (const tc of touches) {
      if (tc.stylus) this.failed = true;
      this.active.set(tc.id, { x: tc.x, y: tc.y });
    }
    this.max = Math.max(this.max, this.active.size);
  }

  move(touches: TapTouch[]): void {
    for (const tc of touches) {
      const s = this.active.get(tc.id);
      if (s && Math.hypot(tc.x - s.x, tc.y - s.y) > MOVE_LIMIT) this.failed = true;
    }
  }

  /** 指が離れた。全部離れたときだけ結果を返す */
  end(ids: number[], t: number): TapResult | null {
    for (const id of ids) this.active.delete(id);
    if (this.active.size > 0) return null;
    if (this.failed || t - this.startTime > TIME_LIMIT) { this.lastTap = null; return null; }
    if (this.max === 1 && this.first) {
      const prev = this.lastTap;
      if (prev && this.startTime - prev.t <= DOUBLE_GAP
        && Math.hypot(this.first.x - prev.x, this.first.y - prev.y) <= DOUBLE_DIST) {
        this.lastTap = null;
        return 'doubleTap';
      }
      this.lastTap = { t, ...this.first };
      return null;
    }
    this.lastTap = null;
    return this.max === 2 ? 'undo' : this.max === 3 ? 'redo' : null;
  }

  cancel(): void { this.failed = true; }
}
