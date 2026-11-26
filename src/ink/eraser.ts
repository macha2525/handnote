import type { Stroke } from '../model/types';

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
