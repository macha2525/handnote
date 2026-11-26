import type { NotebookKind, Section } from '../model/types';
import { INK, REDPEN, RULE, MARKER, DESK, PAPER } from '../model/colors';

/** 講義は「第n回」、資格は「第n章」。n は今ある order の最大+1 */
export function nextSectionLabel(kind: NotebookKind, existing: Section[]): { order: number; label: string } {
  const order = existing.reduce((m, s) => Math.max(m, s.order), 0) + 1;
  return { order, label: kind === 'lecture' ? `第${order}回` : `第${order}章` };
}

function luminance(hex: string): number {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export function contrastRatio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** 背表紙の色。文字は紙か墨のうち、コントラストが高いほう */
export const NOTEBOOK_COLORS: { bg: string; text: string; name: string }[] = [
  { bg: INK, name: '墨' }, { bg: REDPEN, name: '赤' }, { bg: RULE, name: '青' },
  { bg: MARKER, name: '黄' }, { bg: DESK, name: '灰' },
].map(c => ({ ...c, text: contrastRatio(c.bg, PAPER) >= contrastRatio(c.bg, INK) ? PAPER : INK }));

export function textColorFor(bg: string): string {
  return NOTEBOOK_COLORS.find(c => c.bg === bg)?.text ?? INK;
}
