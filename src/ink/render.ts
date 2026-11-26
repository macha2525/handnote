import type { Background, Page, Stroke } from '../model/types';
import { strokeOutline } from './geometry';
import { PAPER, RULE } from '../model/colors';

const RULED_PT = 22.7; // 8mm
const GRID_PT = 14.2;  // 5mm
export const HIGHLIGHTER_ALPHA = 0.35;

function drawBackground(ctx: CanvasRenderingContext2D, page: Page, bg: Background): void {
  if (page.source.type === 'pdf') return; // PDFは下のキャンバスに描かれている
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, page.width, page.height);
  if (bg === 'plain') return;
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  const step = bg === 'ruled' ? RULED_PT : GRID_PT;
  for (let y = step; y < page.height; y += step) { ctx.moveTo(0, y); ctx.lineTo(page.width, y); }
  if (bg === 'grid') for (let x = step; x < page.width; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, page.height); }
  ctx.stroke();
}

export function fillStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  const pts = strokeOutline(stroke);
  if (pts.length < 2) return;
  ctx.save();
  ctx.globalAlpha = stroke.tool === 'highlighter' ? HIGHLIGHTER_ALPHA : 1;
  ctx.fillStyle = stroke.color;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    ctx.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** 背景→蛍光ペン→ペンの順で描く。ctx はページ座標×scale で描く。 */
export function drawPage(ctx: CanvasRenderingContext2D, page: Page, background: Background, scale: number): void {
  ctx.save();
  ctx.scale(scale, scale);
  drawBackground(ctx, page, background);
  for (const s of page.strokes) if (s.tool === 'highlighter') fillStroke(ctx, s);
  for (const s of page.strokes) if (s.tool !== 'highlighter') fillStroke(ctx, s);
  ctx.restore();
}
