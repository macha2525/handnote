// ペン立て：お気に入りのペン（色と太さの組み合わせ）。この端末に覚えておく
import { INK, REDPEN } from '../model/colors';
import { newId } from '../model/ids';

export interface Pen { id: string; color: string; size: number; }

export const MAX_PENS = 8;
export const SIZE_MIN = 0.5;
export const SIZE_MAX = 8;
export const SIZE_STEP = 0.25;

/** 調整パネルの色見本 */
export const PALETTE: { value: string; name: string }[] = [
  { value: INK, name: '墨' }, { value: '#6B7280', name: '灰' }, { value: '#7A5230', name: '茶' },
  { value: REDPEN, name: '赤' }, { value: '#E0612F', name: '朱' }, { value: '#D6578B', name: '桃' },
  { value: '#E89B2C', name: '橙' }, { value: '#2E8B57', name: '緑' }, { value: '#1E8C93', name: '青緑' },
  { value: '#2F6FB3', name: '青' }, { value: '#2B3A8C', name: '紺' }, { value: '#7A4BB0', name: '紫' },
];

export function defaultPens(): Pen[] {
  return [
    { id: 'p1', color: INK, size: 1.5 },
    { id: 'p2', color: INK, size: 2.5 },
    { id: 'p3', color: REDPEN, size: 2.5 },
    { id: 'p4', color: '#2F6FB3', size: 2.5 },
  ];
}

export function clampSize(n: number): number {
  if (!Number.isFinite(n)) return 2.5;
  return Math.min(SIZE_MAX, Math.max(SIZE_MIN, Math.round(n / SIZE_STEP) * SIZE_STEP));
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/** 保存されていた中身を確かめて読み込む。壊れていたら最初のペン立てに戻す */
export function parsePens(raw: string | null): Pen[] {
  if (!raw) return defaultPens();
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return defaultPens();
    const pens = v
      .filter((p): p is Pen => !!p && typeof p.id === 'string' && typeof p.color === 'string' && HEX.test(p.color)
        && typeof p.size === 'number')
      .slice(0, MAX_PENS)
      .map(p => ({ id: p.id, color: p.color, size: clampSize(p.size) }));
    return pens.length ? pens : defaultPens();
  } catch {
    return defaultPens();
  }
}

/** 今のペンをまねて1本足す。いっぱいなら足さない */
export function addPen(pens: Pen[], from: Pen): Pen[] {
  if (pens.length >= MAX_PENS) return pens;
  return [...pens, { id: newId(), color: from.color, size: from.size }];
}

/** 1本は必ず残す */
export function removePen(pens: Pen[], id: string): Pen[] {
  if (pens.length <= 1) return pens;
  return pens.filter(p => p.id !== id);
}

export function updatePen(pens: Pen[], id: string, change: Partial<Omit<Pen, 'id'>>): Pen[] {
  return pens.map(p => (p.id !== id ? p : {
    ...p,
    color: change.color && HEX.test(change.color) ? change.color : p.color,
    size: change.size !== undefined ? clampSize(change.size) : p.size,
  }));
}

const KEY = 'handnote.pens';
export function loadPens(): Pen[] {
  try { return parsePens(localStorage.getItem(KEY)); } catch { return defaultPens(); }
}
export function savePens(pens: Pen[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(pens)); } catch { /* 保存できなくても使える */ }
}
