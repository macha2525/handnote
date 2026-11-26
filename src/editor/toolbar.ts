import { MARKER } from '../model/colors';
import {
  addPen, loadPens, MAX_PENS, PALETTE, removePen, savePens, SIZE_MAX, SIZE_MIN, SIZE_STEP, updatePen, type Pen,
} from './pens';

export type Tool = 'pen' | 'highlighter' | 'eraser';

export const HIGHLIGHTER = { color: MARKER, size: 14 };
export const ERASER_RADIUS = 10;

export type EraserMode = 'stroke' | 'part';
export const ERASER_MODES: { value: EraserMode; name: string; title: string }[] = [
  { value: 'stroke', name: '線ごと', title: '消しゴム：触れた線をまるごと消す' },
  { value: 'part', name: '部分', title: '消しゴム：触れたところだけ消す' },
];
export interface ToolState { tool: Tool; penColor: string; penSize: number; eraserMode: EraserMode; }

const ERASER_MODE_KEY = 'handnote.eraserMode';
function loadEraserMode(): EraserMode {
  try { return localStorage.getItem(ERASER_MODE_KEY) === 'part' ? 'part' : 'stroke'; } catch { return 'stroke'; }
}
function saveEraserMode(m: EraserMode): void {
  try { localStorage.setItem(ERASER_MODE_KEY, m); } catch { /* 保存できなくても動く */ }
}
const PEN_ID_KEY = 'handnote.penId';
function loadPenId(): string | null { try { return localStorage.getItem(PEN_ID_KEY); } catch { return null; } }
function savePenId(id: string): void { try { localStorage.setItem(PEN_ID_KEY, id); } catch { /* 同上 */ } }

/** 太さを、ボタンの中の丸の直径（px）に */
const dotSize = (size: number) => Math.round(5 + size * 2.4);
const sizeLabel = (size: number) => `${size.toFixed(2).replace(/\.?0+$/, '')}`;

export interface Toolbar {
  el: HTMLElement;
  state: ToolState;
  setHistory(canUndo: boolean, canRedo: boolean): void;
  /** 消しゴム⇔直前のペン（または蛍光ペン）を切り替える。切り替え後の道具を返す */
  toggleEraser(): Tool;
}

function button(label: string, title: string, onClick: () => void, cls = ''): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'tb-btn ' + cls;
  b.textContent = label;
  b.title = title;
  b.setAttribute('aria-label', title);
  b.addEventListener('click', onClick);
  return b;
}

export function createToolbar(opts: {
  title: string;
  onBack(): void;
  onUndo(): void;
  onRedo(): void;
  onAddPage(): void;
  onImportPdf(file: File): void;
}): Toolbar {
  let pens = loadPens();
  let penId = pens.some(p => p.id === loadPenId()) ? loadPenId()! : pens[0].id;
  const current = (): Pen => pens.find(p => p.id === penId) ?? pens[0];
  const state: ToolState = { tool: 'pen', penColor: current().color, penSize: current().size, eraserMode: loadEraserMode() };
  const el = document.createElement('div');
  el.className = 'toolbar';

  const back = button('本棚に戻る', '本棚に戻る', opts.onBack, 'tb-back');
  const title = document.createElement('span');
  title.className = 'tb-title';
  title.textContent = opts.title;

  // ---- ペン立て ----
  const penRack = document.createElement('span');
  penRack.className = 'tb-pens';
  const addBtn = button('＋', 'ペンを増やす', () => {
    pens = addPen(pens, current());
    savePens(pens);
    choosePen(pens[pens.length - 1].id);
    openPanel();
  }, 'tb-add');

  function renderRack() {
    penRack.replaceChildren(...pens.map((p, i) => {
      const b = button('', `ペン${i + 1}：太さ${sizeLabel(p.size)}`, () => {
        // 選んでいるペンをもう一度タップしたら調整パネル
        if (state.tool === 'pen' && p.id === penId) { if (panel.hidden) openPanel(); else closePanel(); return; }
        choosePen(p.id);
      }, 'tb-pen');
      b.style.setProperty('--swatch', p.color);
      b.style.setProperty('--dot', `${dotSize(p.size)}px`);
      b.dataset.id = p.id;
      return b;
    }), addBtn);
    addBtn.hidden = pens.length >= MAX_PENS;
  }
  function choosePen(id: string) {
    penId = id;
    savePenId(id);
    closePanel();
    select('pen');
  }

  // ---- 調整パネル ----
  const panel = document.createElement('div');
  panel.className = 'pen-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'ペンの調整');

  const preview = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  preview.setAttribute('viewBox', '0 0 240 48');
  preview.classList.add('pen-preview');
  const previewPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  previewPath.setAttribute('d', 'M12 30 C 50 6, 80 6, 110 24 S 170 44, 228 18');
  previewPath.setAttribute('fill', 'none');
  previewPath.setAttribute('stroke-linecap', 'round');
  preview.append(previewPath);

  const swatches = document.createElement('div');
  swatches.className = 'pen-swatches';
  const swatchBtns = PALETTE.map(c => {
    const b = button('', `色：${c.name}`, () => change({ color: c.value }), 'tb-swatch');
    b.style.setProperty('--swatch', c.value);
    b.dataset.value = c.value;
    return b;
  });
  const custom = document.createElement('label');
  custom.className = 'tb-btn pen-custom';
  const customInput = document.createElement('input');
  customInput.type = 'color';
  customInput.setAttribute('aria-label', 'その他の色');
  customInput.addEventListener('input', () => change({ color: customInput.value.toUpperCase() }));
  custom.append(customInput, document.createTextNode('その他'));
  swatches.append(...swatchBtns, custom);

  const sizeRow = document.createElement('label');
  sizeRow.className = 'pen-size';
  const sizeText = document.createElement('span');
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = String(SIZE_MIN); slider.max = String(SIZE_MAX); slider.step = String(SIZE_STEP);
  slider.setAttribute('aria-label', '太さ');
  slider.addEventListener('input', () => change({ size: Number(slider.value) }));
  sizeRow.append(document.createTextNode('太さ'), slider, sizeText);

  const panelActions = document.createElement('div');
  panelActions.className = 'pen-actions';
  const delBtn = button('このペンを削除', 'このペンを削除', () => {
    const i = pens.findIndex(p => p.id === penId);
    pens = removePen(pens, penId);
    savePens(pens);
    choosePen(pens[Math.max(0, i - 1)].id);
  }, 'pen-delete');
  panelActions.append(delBtn, button('閉じる', '閉じる', () => closePanel()));
  panel.append(preview, swatches, sizeRow, panelActions);

  function change(c: Partial<Omit<Pen, 'id'>>) {
    pens = updatePen(pens, penId, c);
    savePens(pens);
    refresh();
  }
  const outside = (e: PointerEvent) => {
    if (!el.contains(e.target as Node)) closePanel();
  };
  function openPanel() {
    panel.hidden = false;
    refresh();
    document.addEventListener('pointerdown', outside, true);
  }
  function closePanel() {
    panel.hidden = true;
    document.removeEventListener('pointerdown', outside, true);
  }

  const toolBtns: Record<Exclude<Tool, 'pen'>, HTMLButtonElement> = {
    highlighter: button('蛍光', '蛍光ペン', () => select('highlighter')),
    eraser: button('消', '消しゴム（もう一度押すとペンに戻る）', () => toggleEraser()),
  };

  const eraserBtns = ERASER_MODES.map(m => {
    const b = button(m.name, m.title, () => {
      state.eraserMode = m.value; saveEraserMode(m.value); select('eraser');
    }, 'tb-size');
    b.dataset.value = m.value;
    return b;
  });

  const undo = button('元に戻す', '元に戻す', opts.onUndo);
  const redo = button('やり直す', 'やり直す', opts.onRedo);
  const addPage = button('ページを足す', 'ページを足す', opts.onAddPage);

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/pdf';
  fileInput.hidden = true;
  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    fileInput.value = '';
    if (f) opts.onImportPdf(f);
  });
  const importPdf = button('PDFを取り込む', 'PDFを取り込む', () => fileInput.click());

  const sep = () => { const s = document.createElement('span'); s.className = 'tb-sep'; return s; };
  el.append(back, title, sep(), penRack, sep(), toolBtns.highlighter, toolBtns.eraser, ...eraserBtns,
    sep(), undo, redo, sep(), addPage, importPdf, fileInput, panel);

  function refresh() {
    const pen = current();
    state.penColor = pen.color;
    state.penSize = pen.size;
    renderRack();
    for (const b of penRack.querySelectorAll<HTMLButtonElement>('.tb-pen')) {
      b.classList.toggle('is-on', state.tool === 'pen' && b.dataset.id === penId);
    }
    for (const [t, b] of Object.entries(toolBtns)) b.classList.toggle('is-on', state.tool === t);
    for (const b of eraserBtns) b.classList.toggle('is-on', state.tool === 'eraser' && b.dataset.value === state.eraserMode);
    // パネル
    previewPath.setAttribute('stroke', pen.color);
    previewPath.setAttribute('stroke-width', String(pen.size * 2));
    for (const b of swatchBtns) b.classList.toggle('is-on', b.dataset.value === pen.color);
    custom.classList.toggle('is-on', !PALETTE.some(c => c.value === pen.color));
    customInput.value = pen.color.toLowerCase();
    slider.value = String(pen.size);
    sizeText.textContent = sizeLabel(pen.size);
    delBtn.disabled = pens.length <= 1;
  }
  // 消しゴムから戻る先
  let lastDrawTool: Exclude<Tool, 'eraser'> = 'pen';
  function toggleEraser(): Tool {
    select(state.tool === 'eraser' ? lastDrawTool : 'eraser');
    return state.tool;
  }
  function select(t: Tool) {
    if (t !== 'eraser') lastDrawTool = t;
    state.tool = t;
    if (t !== 'pen') closePanel();
    refresh();
  }
  refresh();

  return {
    el, state,
    setHistory(canUndo, canRedo) { undo.disabled = !canUndo; redo.disabled = !canRedo; },
    toggleEraser,
  };
}
