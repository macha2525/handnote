import type { StrokePoint } from '../model/types';

/** これより近い点は「動いていない」とみなす（ページ座標, pt） */
const MIN_STEP = 0.4;
/** 書き始め・書き終わりで、この範囲にとどまっている点は1点にまとめる（pt） */
const STILL_RADIUS = 1.5;
/** 筆圧のならし具合（0..1, 小さいほど強くならす） */
const PRESSURE_ALPHA = 0.35;

/**
 * Apple Pencil の生の入力を、きれいな線になるよう整える。保存は生のまま、描くときに通す。
 * - 最初の点の筆圧0（Safariでよく来る）を、次の本当の筆圧で埋める → 書き始めが針のように細くならない
 * - その場にとどまった書き始め・書き終わりを1点にまとめ、筆圧はとなりの線にそろえる → 止めが丸く残り、点にもならない
 *   （動きながら抜いた払いは、とどまらないので細く抜けたまま）
 * - ほとんど動いていない点を間引く
 * - 筆圧のばらつきを前後からならす（遅れが出ない） → 線のふちがガタガタしない
 */
export function cleanPoints(points: StrokePoint[]): StrokePoint[] {
  if (points.length <= 1) return points.map(fillZero(0.5));
  let pts = backfillPressure(points);
  pts = collapseStill(pts);
  pts = dropTinySteps(pts);
  return smoothPressure(pts);
}

const fillZero = (v: number) => (pt: StrokePoint): StrokePoint => (pt.p > 0 ? pt : { ...pt, p: v });

function backfillPressure(points: StrokePoint[]): StrokePoint[] {
  const first = points.find(pt => pt.p > 0);
  if (!first) return points.map(pt => ({ ...pt, p: 0.5 }));
  let prev = first.p;
  return points.map(pt => {
    if (pt.p > 0) { prev = pt.p; return pt; }
    return { ...pt, p: prev };
  });
}

function collapseStill(points: StrokePoint[]): StrokePoint[] {
  const near = (a: StrokePoint, b: StrokePoint) => Math.hypot(a.x - b.x, a.y - b.y) <= STILL_RADIUS;
  let head = 1;
  while (head < points.length && near(points[head], points[0])) head++;
  const last = points[points.length - 1];
  let tail = points.length - 1;
  while (tail > head && near(points[tail - 1], last)) tail--;
  // 全体がとどまっている（点を打っただけ）なら1点にする
  if (head >= points.length) return [merge(points, Math.max(...points.map(pt => pt.p)))];
  // まとめた点の筆圧は、となりの線の筆圧にそろえる。
  // いちばん強い筆圧を使うと、着地や停止の一瞬の押し込みで、線より太い点が残る
  const middle = points.slice(head, tail);
  const startP = middle.length ? middle[0].p : points[0].p;
  const endP = middle.length ? middle[middle.length - 1].p : last.p;
  return [merge(points.slice(0, head), startP), ...middle, merge(points.slice(tail), endP)];
}

function merge(group: StrokePoint[], p: number): StrokePoint {
  const x = group.reduce((s, pt) => s + pt.x, 0) / group.length;
  const y = group.reduce((s, pt) => s + pt.y, 0) / group.length;
  return { x, y, p };
}

function dropTinySteps(points: StrokePoint[]): StrokePoint[] {
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = out[out.length - 1], b = points[i];
    if (i === points.length - 1 || Math.hypot(b.x - a.x, b.y - a.y) >= MIN_STEP) out.push(b);
  }
  return out;
}

function smoothPressure(points: StrokePoint[]): StrokePoint[] {
  const n = points.length;
  const fwd = new Array<number>(n), bwd = new Array<number>(n);
  fwd[0] = points[0].p;
  for (let i = 1; i < n; i++) fwd[i] = fwd[i - 1] + PRESSURE_ALPHA * (points[i].p - fwd[i - 1]);
  bwd[n - 1] = points[n - 1].p;
  for (let i = n - 2; i >= 0; i--) bwd[i] = bwd[i + 1] + PRESSURE_ALPHA * (points[i].p - bwd[i + 1]);
  return points.map((pt, i) => ({ ...pt, p: (fwd[i] + bwd[i]) / 2 }));
}
