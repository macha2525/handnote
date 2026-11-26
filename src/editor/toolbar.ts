import { icon, type IconName } from '../ui/icons';
import { HIGHLIGHTER_ALPHA } from '../ink/render';
import {
  addPen, HIGHLIGHTER_RACK, loadPenId, loadPens, PEN_RACK, removePen, savePenId, savePens, updatePen,
  type Pen, type RackDef,
} from './pens';

export type Tool = 'pen' | 'highlighter' | 'eraser';

export const ERASER_RADIUS = 10;

export type EraserMode = 'stroke' | 'part';
export const ERASER_MODES: { value: EraserMode; name: string; title: string }[] = [
  { value: 'stroke', name: '線ごと', title: '消しゴム：触れた線をまるごと消す' },
  { value: 'part', name: '部分', title: '消しゴム：触れたところだけ消す' },
];
export interface ToolState {
  tool: Tool;
  penColor: string; penSize: number;
  hlColor: string; hlSize: number;
  eraserMode: EraserMode;
}

const ERASER_MODE_KEY = 'handnote.eraserMode';
function loadEraserMode(): EraserMode {
  try { return localStorage.getItem(ERASER_MODE_KEY) === 'part' ? 'part' : 'stroke'; } catch { return 'stroke'; }
}
function saveEraserMode(m: EraserMode): void {
  try { localStorage.setItem(ERASER_MODE_KEY, m); } catch { /* 保存できなくても動く */ }
}
type DrawTool = 'pen' | 'highlighter';
const RACK_NAME: Record<DrawTool, string> = { pen: 'ペン', highlighter: '蛍光ペン' };

/** 太さを、ボタンの中の印の大きさ（px）に */
const dotSize = (size: number) => Math.round(5 + size * 2.4);
const hlSize = (size: number) => Math.round(4 + size * 0.6);
const sizeLabel = (size: number) => `${size.toFixed(2).replace(/\.?0+$/, '')}`;

export interface Toolbar {
  el: HTMLElement;
  state: ToolState;
  setHistory(canUndo: boolean, canRedo: boolean): void;
  setTitle(title: string): void;
  /** 消しゴム⇔直前のペン（または蛍光ペン）を切り替える。切り替え後の道具を返す */
  toggleEraser(): Tool;
}

function iconButton(name: IconName, title: string, onClick: () => void, cls = ''): HTMLButtonElement {
  const b = button('', title, onClick, 'tb-icon ' + cls);
  b.append(icon(name));
  return b;
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
  /** 題名をタップしたとき（ノートの名前を変える） */
  onRename?(): void;
}): Toolbar {
  // ペン立てと蛍光ペン立て。中身・選択中・ボタンの並びをそれぞれ持つ
  interface Rack { def: RackDef; list: Pen[]; id: string; el: HTMLElement; add: HTMLButtonElement; }
  const makeRack = (kind: DrawTool): Rack => {
    const def = kind === 'pen' ? PEN_RACK : HIGHLIGHTER_RACK;
    const list = loadPens(def);
    const saved = loadPenId(def);
    const el = document.createElement('span');
    el.className = kind === 'pen' ? 'tb-pens' : 'tb-pens tb-hls';
    const add = iconButton('plus', `${RACK_NAME[kind]}を増やす`, () => {
      const r = racks[kind];
      r.list = addPen(r.list, currentOf(kind), r.def);
      savePens(r.list, r.def);
      choose(kind, r.list[r.list.length - 1].id);
      openPanel(kind);
    }, 'tb-add');
    return { def, list, id: list.some(p => p.id === saved) ? saved! : list[0].id, el, add };
  };
  const racks: Record<DrawTool, Rack> = { pen: makeRack('pen'), highlighter: makeRack('highlighter') };
  const currentOf = (kind: DrawTool): Pen => racks[kind].list.find(p => p.id === racks[kind].id) ?? racks[kind].list[0];

  const state: ToolState = {
    tool: 'pen',
    penColor: currentOf('pen').color, penSize: currentOf('pen').size,
    hlColor: currentOf('highlighter').color, hlSize: currentOf('highlighter').size,
    eraserMode: loadEraserMode(),
  };
  const el = document.createElement('div');
  el.className = 'toolbar glass';

  const back = iconButton('back', '本棚に戻る', opts.onBack, 'tb-back');
  const title = button(opts.title, 'ノートの名前を変える', () => opts.onRename?.(), 'tb-title');

  function renderRack(kind: DrawTool) {
    const r = racks[kind];
    r.el.replaceChildren(...r.list.map((p, i) => {
      const b = button('', `${RACK_NAME[kind]}${i + 1}：太さ${sizeLabel(p.size)}`, () => {
        // 選んでいるものをもう一度タップしたら調整パネル
        if (state.tool === kind && p.id === r.id) {
          if (panel.hidden || panelKind !== kind) openPanel(kind); else closePanel();
          return;
        }
        choose(kind, p.id);
      }, kind === 'pen' ? 'tb-pen' : 'tb-pen tb-hl');
      b.style.setProperty('--swatch', p.color);
      b.style.setProperty('--dot', `${kind === 'pen' ? dotSize(p.size) : hlSize(p.size)}px`);
      b.dataset.id = p.id;
      b.classList.toggle('is-on', state.tool === kind && p.id === r.id);
      return b;
    }), r.add);
    r.add.hidden = r.list.length >= r.def.max;
  }
  function choose(kind: DrawTool, id: string) {
    racks[kind].id = id;
    savePenId(id, racks[kind].def);
    closePanel();
    select(kind);
  }

  // ---- 調整パネル（ペンと蛍光ペンで共用） ----
  let panelKind: DrawTool = 'pen';
  const panel = document.createElement('div');
  panel.className = 'pen-panel glass';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');

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
  let swatchBtns: HTMLButtonElement[] = [];
  const custom = document.createElement('label');
  custom.className = 'tb-btn pen-custom';
  const customInput = document.createElement('input');
  customInput.type = 'color';
  customInput.setAttribute('aria-label', 'その他の色');
  customInput.addEventListener('input', () => change({ color: customInput.value.toUpperCase() }));
  custom.append(customInput, document.createTextNode('その他'));
  function buildSwatches() {
    swatchBtns = racks[panelKind].def.palette.map(c => {
      const b = button('', `色：${c.name}`, () => change({ color: c.value }), 'tb-swatch');
      b.style.setProperty('--swatch', c.value);
      b.dataset.value = c.value;
      return b;
    });
    swatches.replaceChildren(...swatchBtns, custom);
  }

  const sizeRow = document.createElement('label');
  sizeRow.className = 'pen-size';
  const sizeText = document.createElement('span');
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.setAttribute('aria-label', '太さ');
  slider.addEventListener('input', () => change({ size: Number(slider.value) }));
  sizeRow.append(document.createTextNode('太さ'), slider, sizeText);

  const panelActions = document.createElement('div');
  panelActions.className = 'pen-actions';
  const delBtn = button('このペンを削除', 'このペンを削除', () => {
    const r = racks[panelKind];
    const i = r.list.findIndex(p => p.id === r.id);
    r.list = removePen(r.list, r.id);
    savePens(r.list, r.def);
    choose(panelKind, r.list[Math.max(0, i - 1)].id);
  }, 'pen-delete');
  panelActions.append(delBtn, button('閉じる', '閉じる', () => closePanel()));
  panel.append(preview, swatches, sizeRow, panelActions);

  function change(c: Partial<Omit<Pen, 'id'>>) {
    const r = racks[panelKind];
    r.list = updatePen(r.list, r.id, c, r.def);
    savePens(r.list, r.def);
    refresh();
  }
  const outside = (e: PointerEvent) => {
    if (!el.contains(e.target as Node)) closePanel();
  };
  function openPanel(kind: DrawTool) {
    panelKind = kind;
    const def = racks[kind].def;
    panel.setAttribute('aria-label', `${RACK_NAME[kind]}の調整`);
    slider.min = String(def.sizeMin); slider.max = String(def.sizeMax); slider.step = String(def.sizeStep);
    delBtn.textContent = `この${RACK_NAME[kind]}を削除`;
    delBtn.title = delBtn.textContent;
    delBtn.setAttribute('aria-label', delBtn.textContent);
    buildSwatches();
    panel.hidden = false;
    refresh();
    document.addEventListener('pointerdown', outside, true);
  }
  function closePanel() {
    panel.hidden = true;
    document.removeEventListener('pointerdown', outside, true);
  }

  const eraserBtn = button('消', '消しゴム（もう一度押すとペンに戻る）', () => toggleEraser());
  const eraserBtns = ERASER_MODES.map(m => {
    const b = button(m.name, m.title, () => {
      state.eraserMode = m.value; saveEraserMode(m.value); select('eraser');
    }, 'tb-size');
    b.dataset.value = m.value;
    return b;
  });

  const undo = iconButton('undo', '元に戻す', opts.onUndo);
  const redo = iconButton('redo', 'やり直す', opts.onRedo);
  const addPage = iconButton('page-add', 'ページを足す', opts.onAddPage);

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/pdf';
  fileInput.hidden = true;
  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    fileInput.value = '';
    if (f) opts.onImportPdf(f);
  });
  const importPdf = iconButton('pdf', 'PDFを取り込む', () => fileInput.click());

  const sep = () => { const s = document.createElement('span'); s.className = 'tb-sep'; return s; };
  el.append(back, title, sep(), racks.pen.el, sep(), racks.highlighter.el, sep(), eraserBtn, ...eraserBtns,
    sep(), undo, redo, sep(), addPage, importPdf, fileInput, panel);

  function refresh() {
    const pen = currentOf('pen'), hl = currentOf('highlighter');
    state.penColor = pen.color; state.penSize = pen.size;
    state.hlColor = hl.color; state.hlSize = hl.size;
    renderRack('pen');
    renderRack('highlighter');
    eraserBtn.classList.toggle('is-on', state.tool === 'eraser');
    for (const b of eraserBtns) b.classList.toggle('is-on', state.tool === 'eraser' && b.dataset.value === state.eraserMode);
    // パネル
    const cur = currentOf(panelKind);
    const palette = racks[panelKind].def.palette;
    const isHl = panelKind === 'highlighter';
    previewPath.setAttribute('stroke', cur.color);
    previewPath.setAttribute('stroke-width', String(cur.size * (isHl ? 1 : 2)));
    previewPath.setAttribute('stroke-opacity', String(isHl ? HIGHLIGHTER_ALPHA : 1));
    previewPath.setAttribute('stroke-linecap', isHl ? 'butt' : 'round');
    for (const b of swatchBtns) b.classList.toggle('is-on', b.dataset.value === cur.color);
    custom.classList.toggle('is-on', !palette.some(c => c.value === cur.color));
    customInput.value = cur.color.toLowerCase();
    slider.value = String(cur.size);
    sizeText.textContent = sizeLabel(cur.size);
    delBtn.disabled = racks[panelKind].list.length <= 1;
  }
  // 消しゴムから戻る先
  let lastDrawTool: DrawTool = 'pen';
  function toggleEraser(): Tool {
    select(state.tool === 'eraser' ? lastDrawTool : 'eraser');
    return state.tool;
  }
  function select(t: Tool) {
    if (t !== 'eraser') lastDrawTool = t;
    state.tool = t;
    if (t !== panelKind) closePanel();
    refresh();
  }
  refresh();

  return {
    el, state,
    setHistory(canUndo, canRedo) { undo.disabled = !canUndo; redo.disabled = !canRedo; },
    toggleEraser,
    setTitle(t) { title.textContent = t; },
  };
}
