import type { Stroke, StrokePoint } from '../model/types';
import { newId } from '../model/ids';

type Pt = { x: number; y: number };

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function strokeHit(stroke: Stroke, pt: Pt, radius: number): boolean {
  const lim = radius + stroke.size / 2;
  const ps = stroke.points;
  if (ps.length === 1) return Math.hypot(pt.x - ps[0].x, pt.y - ps[0].y) <= lim;
  for (let i = 1; i < ps.length; i++) {
    if (distToSegment(pt, ps[i - 1], ps[i]) <= lim) return true;
  }
  return false;
}

/** 当たった線を丸ごと消す。元の配列は変更しない。 */
export function eraseAt(strokes: Stroke[], pt: Pt, radius: number): { kept: Stroke[]; removed: Stroke[] } {
  const kept: Stroke[] = [], removed: Stroke[] = [];
  for (const s of strokes) (strokeHit(s, pt, radius) ? removed : kept).push(s);
  return { kept, removed };
}

/** 線分 a→b のうち、円（中心 c, 半径 r）の中にある範囲 [t0, t1]（0..1）。なければ null */
function insideRange(a: StrokePoint, b: StrokePoint, c: Pt, r: number): [number, number] | null {
  const dx = b.x - a.x, dy = b.y - a.y;
  const fx = a.x - c.x, fy = a.y - c.y;
  const A = dx * dx + dy * dy;
  const C = fx * fx + fy * fy - r * r;
  if (A === 0) return C <= 0 ? [0, 1] : null;
  const B = 2 * (fx * dx + fy * dy);
  const disc = B * B - 4 * A * C;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  const t0 = Math.max(0, (-B - sq) / (2 * A)), t1 = Math.min(1, (-B + sq) / (2 * A));
  return t0 <= t1 ? [t0, t1] : null;
}

const lerp = (a: StrokePoint, b: StrokePoint, t: number): StrokePoint =>
  ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, p: a.p + (b.p - a.p) * t });

const pathLength = (ps: StrokePoint[]) =>
  ps.reduce((sum, p, i) => (i ? sum + Math.hypot(p.x - ps[i - 1].x, p.y - ps[i - 1].y) : 0), 0);

/** 線の、円の中にかかった部分だけを切り取る。残りは切れ端として返す（0本・1本・複数本） */
function cutStroke(stroke: Stroke, c: Pt, r: number): Stroke[] {
  const lim = r + stroke.size / 2;
  const ps = stroke.points;
  const inside = (p: StrokePoint) => Math.hypot(p.x - c.x, p.y - c.y) <= lim;
  const pieces: StrokePoint[][] = [];
  let cur: StrokePoint[] = inside(ps[0]) ? [] : [ps[0]];
  for (let i = 1; i < ps.length; i++) {
    const a = ps[i - 1], b = ps[i];
    const hit = insideRange(a, b, c, lim);
    if (!hit) { cur.push(b); continue; }
    const [t0, t1] = hit;
    if (t0 > 0) cur.push(lerp(a, b, t0));
    if (cur.length) pieces.push(cur);
    cur = t1 < 1 ? [lerp(a, b, t1), b] : [];
  }
  if (cur.length) pieces.push(cur);
  // 消し残りのごく小さなかけらは捨てる（点だけの線は、触れていなければここに来ない）
  return pieces
    .filter(pts => pts.length > 1 && pathLength(pts) >= 0.5)
    .map(points => ({ ...stroke, id: newId(), points }));
}

/** 消しゴム（部分）：触れたところだけ消す。切れ端は元の線と同じ重なり順の位置に入る */
export function erasePartAt(strokes: Stroke[], pt: Pt, radius: number): { strokes: Stroke[]; changed: boolean } {
  let changed = false;
  const out: Stroke[] = [];
  for (const s of strokes) {
    if (!strokeHit(s, pt, radius)) { out.push(s); continue; }
    changed = true;
    out.push(...cutStroke(s, pt, radius));
  }
  return { strokes: changed ? out : strokes, changed };
}
