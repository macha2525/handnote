import { getStroke } from 'perfect-freehand';
import type { Stroke, StrokePoint } from '../model/types';

/** 線の外形（ページ座標）。ペンは筆圧で太さが変わり、蛍光ペンは一定の太さ。 */
export function strokeOutline(stroke: Stroke): [number, number][] {
  const hl = stroke.tool === 'highlighter';
  const input = stroke.points.map(pt => [pt.x, pt.y, hl ? 0.5 : pt.p]);
  return getStroke(input, {
    size: stroke.size,
    simulatePressure: false,
    thinning: hl ? 0 : 0.6,
    smoothing: 0.5,
    streamline: 0.4,
    last: true,
  }) as [number, number][];
}

export function toScreen(pt: StrokePoint, scale: number): { x: number; y: number } {
  return { x: pt.x * scale, y: pt.y * scale };
}

export function toPage(x: number, y: number, scale: number, p: number): StrokePoint {
  return { x: x / scale, y: y / scale, p };
}
