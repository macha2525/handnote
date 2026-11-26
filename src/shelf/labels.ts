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

/** 背表紙の色（藍の机で映える5色）。文字は紙か墨のうち、コントラストが高いほう */
export const NOTEBOOK_COLORS: { bg: string; name: string }[] = [
  { bg: '#2E4B8A', name: '藍' }, { bg: '#8A3A45', name: '臙脂' }, { bg: '#3F6E70', name: '青磁' },
  { bg: '#B8955A', name: '真鍮' }, { bg: '#5A4A7E', name: '葡萄' },
];

/** 前のデザインの色 → 新しい色 */
const OLD_TO_NEW: Record<string, string> = {
  [INK]: '#2E4B8A', [REDPEN]: '#8A3A45', [RULE]: '#3F6E70', [MARKER]: '#B8955A', [DESK]: '#5A4A7E',
};

const HEX = /^#[0-9a-f]{6}$/i;

/** 保存されている色（古い色も含む）から、背表紙の塗りと文字の色を決める */
export function spineTone(stored: string): { bg: string; text: string } {
  const key = Object.keys(OLD_TO_NEW).find(k => k.toLowerCase() === stored.toLowerCase());
  const bg = key ? OLD_TO_NEW[key] : HEX.test(stored) ? stored : NOTEBOOK_COLORS[0].bg;
  const text = contrastRatio(bg, PAPER) >= contrastRatio(bg, INK) ? PAPER : INK;
  return { bg, text };
}
