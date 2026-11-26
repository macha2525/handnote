/** 指のタップで元に戻す（2本）・やり直す（3本）。動かしたり長く押したりしたら、スクロールや拡大とみなす */
export interface TapTouch { id: number; x: number; y: number; stylus: boolean; }

/** これ以上動いたらタップではない（px） */
const MOVE_LIMIT = 12;
/** 最初の指が触れてから、全部離れるまでの上限（ms） */
const TIME_LIMIT = 350;

export class TapGesture {
  private active = new Map<number, { x: number; y: number }>();
  private max = 0;
  private startTime = 0;
  private failed = false;

  start(touches: TapTouch[], t: number): void {
    if (this.active.size === 0) { this.max = 0; this.startTime = t; this.failed = false; }
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
  end(ids: number[], t: number): 'undo' | 'redo' | null {
    for (const id of ids) this.active.delete(id);
    if (this.active.size > 0) return null;
    if (this.failed || t - this.startTime > TIME_LIMIT) return null;
    return this.max === 2 ? 'undo' : this.max === 3 ? 'redo' : null;
  }

  cancel(): void { this.failed = true; }
}
