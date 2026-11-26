import type { Stroke } from '../model/types';

/** replace：消しゴム1回ぶん。ページの線を前後まるごと覚えるので、取り消しても重なり順が変わらない */
export type InkOp = { kind: 'add'; stroke: Stroke } | { kind: 'replace'; before: Stroke[]; after: Stroke[] };

const LIMIT = 200;

function apply(op: InkOp, strokes: Stroke[]): Stroke[] {
  if (op.kind === 'add') return [...strokes, op.stroke];
  return [...op.after];
}
function revert(op: InkOp, strokes: Stroke[]): Stroke[] {
  if (op.kind === 'add') return strokes.filter(s => s.id !== op.stroke.id);
  return [...op.before];
}

/** 元に戻す・やり直す。上限200手。新しい操作でやり直しは消える。 */
export class History {
  private done: InkOp[] = [];
  private undone: InkOp[] = [];

  push(op: InkOp): void {
    this.done.push(op);
    if (this.done.length > LIMIT) this.done.shift();
    this.undone = [];
  }
  undo(strokes: Stroke[]): Stroke[] {
    const op = this.done.pop();
    if (!op) return strokes;
    this.undone.push(op);
    return revert(op, strokes);
  }
  redo(strokes: Stroke[]): Stroke[] {
    const op = this.undone.pop();
    if (!op) return strokes;
    this.done.push(op);
    return apply(op, strokes);
  }
  /** 次に戻す操作（どのページの操作かを編集画面が調べるため） */
  peekUndo(): InkOp | undefined { return this.done[this.done.length - 1]; }
  peekRedo(): InkOp | undefined { return this.undone[this.undone.length - 1]; }
  canUndo(): boolean { return this.done.length > 0; }
  canRedo(): boolean { return this.undone.length > 0; }
}
