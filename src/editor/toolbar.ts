import { INK, REDPEN, MARKER } from '../model/colors';

export type Tool = 'pen' | 'highlighter' | 'eraser';

export const PEN_COLORS = [
  { value: INK, name: '墨' },
  { value: REDPEN, name: '赤' },
  { value: '#2F6FB3', name: '青' },
];
export const PEN_SIZES = [
  { value: 1.5, name: '細' },
  { value: 2.5, name: '中' },
  { value: 4, name: '太' },
];
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

export interface Toolbar {
  el: HTMLElement;
  state: ToolState;
  setHistory(canUndo: boolean, canRedo: boolean): void;
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
  const state: ToolState = { tool: 'pen', penColor: PEN_COLORS[0].value, penSize: PEN_SIZES[1].value, eraserMode: loadEraserMode() };
  const el = document.createElement('div');
  el.className = 'toolbar';

  const back = button('本棚に戻る', '本棚に戻る', opts.onBack, 'tb-back');
  const title = document.createElement('span');
  title.className = 'tb-title';
  title.textContent = opts.title;

  const toolBtns: Record<Tool, HTMLButtonElement> = {
    pen: button('ペン', 'ペン', () => select('pen')),
    highlighter: button('蛍光', '蛍光ペン', () => select('highlighter')),
    eraser: button('消', '消しゴム', () => select('eraser')),
  };

  const colorBtns = PEN_COLORS.map(c => {
    const b = button('', `ペンの色：${c.name}`, () => { state.penColor = c.value; select('pen'); }, 'tb-swatch');
    b.style.setProperty('--swatch', c.value);
    b.dataset.value = c.value;
    return b;
  });
  const sizeBtns = PEN_SIZES.map(s => {
    const b = button(s.name, `ペンの太さ：${s.name}`, () => { state.penSize = s.value; select('pen'); }, 'tb-size');
    b.dataset.value = String(s.value);
    return b;
  });

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
  el.append(back, title, sep(), toolBtns.pen, ...colorBtns, ...sizeBtns, toolBtns.highlighter, toolBtns.eraser, ...eraserBtns,
    sep(), undo, redo, sep(), addPage, importPdf, fileInput);

  function refresh() {
    for (const [t, b] of Object.entries(toolBtns)) b.classList.toggle('is-on', state.tool === t);
    for (const b of colorBtns) b.classList.toggle('is-on', state.tool === 'pen' && b.dataset.value === state.penColor);
    for (const b of sizeBtns) b.classList.toggle('is-on', state.tool === 'pen' && Number(b.dataset.value) === state.penSize);
    for (const b of eraserBtns) b.classList.toggle('is-on', state.tool === 'eraser' && b.dataset.value === state.eraserMode);
  }
  function select(t: Tool) { state.tool = t; refresh(); }
  refresh();

  return {
    el, state,
    setHistory(canUndo, canRedo) { undo.disabled = !canUndo; redo.disabled = !canRedo; },
  };
}
