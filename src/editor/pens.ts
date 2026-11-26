// ペン立て・蛍光ペン立て：お気に入りの色と太さの組み合わせ。この端末に覚えておく
import { INK, MARKER, REDPEN } from '../model/colors';
import { newId } from '../model/ids';

export interface Pen { id: string; color: string; size: number; }

/** ペン立ての決まりごと（ペンと蛍光ペンで別々） */
export interface RackDef {
  /** 保存の鍵（ペン立ての中身 / 最後に選んだもの） */
  key: string;
  idKey: string;
  max: number;
  sizeMin: number;
  sizeMax: number;
  sizeStep: number;
  defaultSize: number;
  palette: { value: string; name: string }[];
  defaults(): Pen[];
}

export const PEN_RACK: RackDef = {
  key: 'handnote.pens', idKey: 'handnote.penId',
  max: 8, sizeMin: 0.5, sizeMax: 8, sizeStep: 0.25, defaultSize: 2.5,
  palette: [
    { value: INK, name: '墨' }, { value: '#6B7280', name: '灰' }, { value: '#7A5230', name: '茶' },
    { value: REDPEN, name: '赤' }, { value: '#E0612F', name: '朱' }, { value: '#D6578B', name: '桃' },
    { value: '#E89B2C', name: '橙' }, { value: '#2E8B57', name: '緑' }, { value: '#1E8C93', name: '青緑' },
    { value: '#2F6FB3', name: '青' }, { value: '#2B3A8C', name: '紺' }, { value: '#7A4BB0', name: '紫' },
  ],
  defaults: () => [
    { id: 'p1', color: INK, size: 1.5 },
    { id: 'p2', color: INK, size: 2.5 },
    { id: 'p3', color: REDPEN, size: 2.5 },
    { id: 'p4', color: '#2F6FB3', size: 2.5 },
  ],
};

/** 蛍光ペンは紙に半透明で重ねるので、淡く明るい色を並べる */
export const HIGHLIGHTER_RACK: RackDef = {
  key: 'handnote.highlighters', idKey: 'handnote.highlighterId',
  max: 6, sizeMin: 6, sizeMax: 30, sizeStep: 1, defaultSize: 14,
  palette: [
    { value: MARKER, name: '黄' }, { value: '#F7B267', name: '橙' }, { value: '#F4A6C0', name: '桃' },
    { value: '#F08A8A', name: '赤' }, { value: '#C9A7F0', name: '紫' }, { value: '#9CCCF5', name: '水色' },
    { value: '#7FB3F0', name: '青' }, { value: '#8FE0D0', name: '青緑' }, { value: '#A8E6A1', name: '緑' },
    { value: '#D4E88A', name: '黄緑' }, { value: '#D9C3A0', name: 'ベージュ' }, { value: '#C4C9D4', name: '灰' },
  ],
  defaults: () => [
    { id: 'h1', color: MARKER, size: 14 },
    { id: 'h2', color: '#F4A6C0', size: 14 },
    { id: 'h3', color: '#A8E6A1', size: 14 },
    { id: 'h4', color: '#9CCCF5', size: 14 },
  ],
};

// これまでの呼び方（ペン立て）
export const MAX_PENS = PEN_RACK.max;
export const SIZE_MIN = PEN_RACK.sizeMin;
export const SIZE_MAX = PEN_RACK.sizeMax;
export const SIZE_STEP = PEN_RACK.sizeStep;
export const PALETTE = PEN_RACK.palette;
export const defaultPens = (): Pen[] => PEN_RACK.defaults();

export function clampSize(n: number, rack: RackDef = PEN_RACK): number {
  if (!Number.isFinite(n)) return rack.defaultSize;
  return Math.min(rack.sizeMax, Math.max(rack.sizeMin, Math.round(n / rack.sizeStep) * rack.sizeStep));
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/** 保存されていた中身を確かめて読み込む。壊れていたら最初のペン立てに戻す */
export function parsePens(raw: string | null, rack: RackDef = PEN_RACK): Pen[] {
  if (!raw) return rack.defaults();
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return rack.defaults();
    const pens = v
      .filter((p): p is Pen => !!p && typeof p.id === 'string' && typeof p.color === 'string' && HEX.test(p.color)
        && typeof p.size === 'number')
      .slice(0, rack.max)
      .map(p => ({ id: p.id, color: p.color, size: clampSize(p.size, rack) }));
    return pens.length ? pens : rack.defaults();
  } catch {
    return rack.defaults();
  }
}

/** 今のペンをまねて1本足す。いっぱいなら足さない */
export function addPen(pens: Pen[], from: Pen, rack: RackDef = PEN_RACK): Pen[] {
  if (pens.length >= rack.max) return pens;
  return [...pens, { id: newId(), color: from.color, size: from.size }];
}

/** 1本は必ず残す */
export function removePen(pens: Pen[], id: string): Pen[] {
  if (pens.length <= 1) return pens;
  return pens.filter(p => p.id !== id);
}

export function updatePen(pens: Pen[], id: string, change: Partial<Omit<Pen, 'id'>>, rack: RackDef = PEN_RACK): Pen[] {
  return pens.map(p => (p.id !== id ? p : {
    ...p,
    color: change.color && HEX.test(change.color) ? change.color : p.color,
    size: change.size !== undefined ? clampSize(change.size, rack) : p.size,
  }));
}

export function loadPens(rack: RackDef = PEN_RACK): Pen[] {
  try { return parsePens(localStorage.getItem(rack.key), rack); } catch { return rack.defaults(); }
}
export function savePens(pens: Pen[], rack: RackDef = PEN_RACK): void {
  try { localStorage.setItem(rack.key, JSON.stringify(pens)); } catch { /* 保存できなくても使える */ }
}
export function loadPenId(rack: RackDef = PEN_RACK): string | null {
  try { return localStorage.getItem(rack.idKey); } catch { return null; }
}
export function savePenId(id: string, rack: RackDef = PEN_RACK): void {
  try { localStorage.setItem(rack.idKey, id); } catch { /* 同上 */ }
}
