import { describe, it, expect } from 'vitest';
import { drawPage } from '../../src/ink/render';
import type { Page } from '../../src/model/types';

function mockCtx() {
  const calls: { op: string; fillStyle: unknown; alpha: number }[] = [];
  const ctx: Record<string, unknown> = { fillStyle: '', strokeStyle: '', globalAlpha: 1, lineWidth: 1 };
  for (const m of ['save', 'restore', 'beginPath', 'moveTo', 'lineTo', 'quadraticCurveTo', 'closePath', 'fill', 'stroke', 'fillRect', 'clearRect', 'setTransform', 'scale', 'arc']) {
    ctx[m] = () => calls.push({ op: m, fillStyle: ctx.fillStyle, alpha: ctx.globalAlpha as number });
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

describe('drawPage', () => {
  it('drawPage draws highlighter before pen', () => {
    const pts = [{ x: 10, y: 10, p: 0.5 }, { x: 50, y: 10, p: 0.5 }, { x: 90, y: 12, p: 0.5 }];
    const page: Page = {
      id: 'p', source: { type: 'blank' }, width: 595, height: 842,
      strokes: [
        { id: 'pen', tool: 'pen', color: '#111111', size: 2.5, points: pts },
        { id: 'hl', tool: 'highlighter', color: '#F2D35B', size: 14, points: pts },
      ],
    };
    const { ctx, calls } = mockCtx();
    drawPage(ctx, page, 'ruled', 1);
    const fills = calls.filter(c => c.op === 'fill');
    const hl = fills.findIndex(c => c.fillStyle === '#F2D35B');
    const pen = fills.findIndex(c => c.fillStyle === '#111111');
    expect(hl).toBeGreaterThanOrEqual(0);
    expect(pen).toBeGreaterThan(hl);
    expect(fills[hl].alpha).toBeCloseTo(0.35);
  });
});
