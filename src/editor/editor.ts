import type { Note, Page, Stroke, StrokePoint } from '../model/types';
import { A4 } from '../model/types';
import { newId } from '../model/ids';
import { getNote, saveNote } from '../storage/db';
import { History, type InkOp } from '../ink/history';
import { attachInkInput, type InputState } from '../ink/input';
import { drawPage, fillStroke } from '../ink/render';
import { eraseAt } from '../ink/eraser';
import { createAutosave } from './autosave';
import { createToolbar, HIGHLIGHTER, ERASER_RADIUS } from './toolbar';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const PAGE_GAP = 16;
/** iPadのSafariはキャンバス1枚の画素数に上限があるので、これを超えないよう解像度を落とす */
const MAX_CANVAS_PIXELS = 6_000_000;

export interface EditorOptions {
  onBack(): void;
  onImportPdf(file: File, note: Note): void;
  /** PDFページなど、線の下に描くもの。Task 5 で使う */
  underlay?: {
    render(page: Page, canvas: HTMLCanvasElement, scale: number): Promise<void>;
  };
  /** 描くページを絞る。既定はすべてのページ */
  visibleRange?(scrollTop: number, viewportH: number, tops: number[], heights: number[]): [number, number];
  /** ページを足す位置の決め方（既定は末尾） */
  addPage?(note: Note, currentIndex: number): Note;
}

interface PageView {
  el: HTMLDivElement;
  under: HTMLCanvasElement | null;
  ink: HTMLCanvasElement | null;
  detach: (() => void) | null;
}

function pixelScale(page: Page, scale: number): number {
  const dpr = window.devicePixelRatio || 1;
  const want = scale * dpr;
  const cap = Math.sqrt(MAX_CANVAS_PIXELS / (page.width * page.height));
  return Math.min(want, cap);
}

function sizeCanvas(c: HTMLCanvasElement, page: Page, ps: number) {
  c.width = Math.max(1, Math.round(page.width * ps));
  c.height = Math.max(1, Math.round(page.height * ps));
}

export async function openEditor(root: HTMLElement, noteId: string, opts: EditorOptions): Promise<() => Promise<void>> {
  const loaded = await getNote(noteId);
  if (!loaded) throw new Error('ノートが見つかりません');
  const note: Note = loaded;

  root.replaceChildren();
  root.className = 'screen editor';

  const history = new History();
  const opPage = new WeakMap<InkOp, string>();
  const inputState: InputState = { penSeen: false };
  const autosave = createAutosave(saveNote);

  const banner = document.createElement('div');
  banner.className = 'save-error';
  banner.setAttribute('role', 'alert');
  banner.hidden = true;
  autosave.onError(e => {
    banner.textContent = e.name === 'StorageFullError'
      ? '保存できませんでした。iPadの空き容量を確認してください'
      : '保存できませんでした。もう一度書くと保存し直します';
    banner.hidden = false;
  });
  autosave.onSaved(() => { banner.hidden = true; });

  const toolbar = createToolbar({
    title: note.title,
    onBack: opts.onBack,
    onUndo: () => step('undo'),
    onRedo: () => step('redo'),
    onAddPage: () => addPage(),
    onImportPdf: f => opts.onImportPdf(f, note),
  });

  const scroller = document.createElement('div');
  scroller.className = 'pages';
  const inner = document.createElement('div');
  inner.className = 'pages-inner';
  scroller.append(inner);
  root.append(toolbar.el, banner, scroller);

  let zoom = 1;
  let views: PageView[] = [];
  let tops: number[] = [];
  let heights: number[] = [];

  const fitScale = () => {
    const maxW = Math.max(...note.pages.map(p => p.width), A4.width);
    return Math.max(0.1, (scroller.clientWidth - PAGE_GAP * 2) / maxW);
  };
  const scale = () => fitScale() * zoom;

  function changed() {
    note.updatedAt = Date.now();
    autosave.schedule(note);
    toolbar.setHistory(history.canUndo(), history.canRedo());
  }

  // ---- ページの配置 ----
  function layout() {
    const s = scale();
    let y = PAGE_GAP;
    tops = []; heights = [];
    note.pages.forEach((p, i) => {
      const v = views[i];
      v.el.style.width = `${p.width * s}px`;
      v.el.style.height = `${p.height * s}px`;
      tops.push(y);
      heights.push(p.height * s);
      y += p.height * s + PAGE_GAP;
    });
  }

  function buildViews() {
    for (const v of views) unmount(v);
    inner.replaceChildren();
    views = note.pages.map(() => {
      const el = document.createElement('div');
      el.className = 'page';
      inner.append(el);
      return { el, under: null, ink: null, detach: null };
    });
    layout();
  }

  function unmount(v: PageView) {
    v.detach?.();
    v.detach = null;
    v.under?.remove(); v.ink?.remove();
    v.under = null; v.ink = null;
  }

  function drawInk(i: number) {
    const v = views[i], page = note.pages[i];
    if (!v.ink) return;
    const ps = pixelScale(page, scale());
    sizeCanvas(v.ink, page, ps);
    const ctx = v.ink.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, v.ink.width, v.ink.height);
    drawPage(ctx, page, note.background, ps);
  }

  function drawUnder(i: number) {
    const v = views[i], page = note.pages[i];
    if (!v.under || !opts.underlay) return;
    const ps = pixelScale(page, scale());
    opts.underlay.render(page, v.under, ps).catch(() => { /* 範囲外で破棄された等 */ });
  }

  function mount(i: number) {
    const v = views[i];
    if (v.ink) return;
    const page = note.pages[i];
    if (page.source.type === 'pdf' && opts.underlay) {
      v.under = document.createElement('canvas');
      v.under.className = 'layer under';
      v.el.append(v.under);
      drawUnder(i);
    }
    v.ink = document.createElement('canvas');
    v.ink.className = 'layer ink';
    v.el.append(v.ink);
    drawInk(i);
    v.detach = attachPageInput(i);
  }

  let rangeFrame = 0;
  function refreshRange() {
    cancelAnimationFrame(rangeFrame);
    rangeFrame = requestAnimationFrame(() => {
      const [a, b] = opts.visibleRange
        ? opts.visibleRange(scroller.scrollTop, scroller.clientHeight, tops, heights)
        : [0, note.pages.length - 1];
      views.forEach((v, i) => { if (i < a || i > b) unmount(v); });
      for (let i = a; i <= b && i < views.length; i++) mount(i);
    });
  }

  function redrawAll() {
    layout();
    views.forEach((v, i) => { if (v.ink) { drawInk(i); drawUnder(i); } });
    refreshRange();
  }

  // ---- 書く・消す ----
  function attachPageInput(i: number): () => void {
    const v = views[i];
    let live: Stroke | null = null;
    let liveCanvas: HTMLCanvasElement | null = null;
    let erased: Stroke[] = [];
    let ps = 1;

    const drawLive = () => {
      if (!live || !liveCanvas) return;
      const ctx = liveCanvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, liveCanvas.width, liveCanvas.height);
      ctx.scale(ps, ps);
      fillStroke(ctx, live);
    };
    const erase = (p: StrokePoint) => {
      const page = note.pages[i];
      const { kept, removed } = eraseAt(page.strokes, p, ERASER_RADIUS);
      if (!removed.length) return;
      page.strokes = kept;
      erased.push(...removed);
      drawInk(i);
    };

    return attachInkInput(v.el, {
      state: inputState,
      getScale: scale,
      onStrokeStart(p) {
        const t = toolbar.state;
        if (t.tool === 'eraser') { erased = []; erase(p); return; }
        const page = note.pages[i];
        ps = pixelScale(page, scale());
        live = t.tool === 'pen'
          ? { id: newId(), tool: 'pen', color: t.penColor, size: t.penSize, points: [p] }
          : { id: newId(), tool: 'highlighter', color: HIGHLIGHTER.color, size: HIGHLIGHTER.size, points: [p] };
        liveCanvas = document.createElement('canvas');
        liveCanvas.className = 'layer live';
        sizeCanvas(liveCanvas, page, ps);
        v.el.append(liveCanvas);
        drawLive();
      },
      onStrokeMove(p) {
        if (toolbar.state.tool === 'eraser' && !live) { erase(p); return; }
        if (!live) return;
        live.points.push(p);
        drawLive();
      },
      onStrokeEnd() {
        if (live) {
          const s = live;
          live = null;
          liveCanvas?.remove(); liveCanvas = null;
          note.pages[i].strokes.push(s);
          const op: InkOp = { kind: 'add', stroke: s };
          history.push(op); opPage.set(op, note.pages[i].id);
          drawInk(i);
          changed();
        } else if (erased.length) {
          const op: InkOp = { kind: 'remove', strokes: erased };
          erased = [];
          history.push(op); opPage.set(op, note.pages[i].id);
          changed();
        }
      },
    });
  }

  function step(dir: 'undo' | 'redo') {
    const op = dir === 'undo' ? history.peekUndo() : history.peekRedo();
    if (!op) return;
    const i = note.pages.findIndex(p => p.id === opPage.get(op));
    if (i < 0) return;
    const page = note.pages[i];
    page.strokes = dir === 'undo' ? history.undo(page.strokes) : history.redo(page.strokes);
    drawInk(i);
    changed();
  }

  function currentIndex(): number {
    const mid = scroller.scrollTop + scroller.clientHeight / 2;
    let idx = 0;
    tops.forEach((t, i) => { if (t <= mid) idx = i; });
    return idx;
  }

  function addPage() {
    const i = currentIndex();
    if (opts.addPage) {
      const next = opts.addPage(note, i);
      note.pages = next.pages;
    } else {
      note.pages.push({ id: newId(), source: { type: 'blank' }, width: A4.width, height: A4.height, strokes: [] });
    }
    buildViews();
    refreshRange();
    changed();
  }

  // ---- 拡大・縮小（指2本 / Ctrl+ホイール） ----
  function setZoom(z: number, cx: number, cy: number) {
    const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
    if (nz === zoom) return;
    const r = scroller.getBoundingClientRect();
    const ax = scroller.scrollLeft + cx - r.left, ay = scroller.scrollTop + cy - r.top;
    const k = nz / zoom;
    zoom = nz;
    layout();
    scroller.scrollLeft = ax * k - (cx - r.left);
    scroller.scrollTop = ay * k - (cy - r.top);
  }

  let pinch: { d: number; z: number } | null = null;
  const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) pinch = { d: dist(e.touches), z: zoom };
  };
  const onTouchMove = (e: TouchEvent) => {
    if (!pinch || e.touches.length !== 2) return;
    e.preventDefault();
    const t = e.touches;
    setZoom(pinch.z * dist(t) / pinch.d, (t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2);
  };
  const onTouchEnd = (e: TouchEvent) => {
    if (pinch && e.touches.length < 2) { pinch = null; redrawAll(); }
  };
  let wheelTimer: ReturnType<typeof setTimeout> | undefined;
  const onWheel = (e: WheelEvent) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setZoom(zoom * Math.exp(-e.deltaY / 300), e.clientX, e.clientY);
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(redrawAll, 150);
  };
  const stopGesture = (e: Event) => e.preventDefault();

  scroller.addEventListener('touchstart', onTouchStart, { passive: true });
  scroller.addEventListener('touchmove', onTouchMove, { passive: false });
  scroller.addEventListener('touchend', onTouchEnd);
  scroller.addEventListener('touchcancel', onTouchEnd);
  scroller.addEventListener('wheel', onWheel, { passive: false });
  scroller.addEventListener('gesturestart', stopGesture);
  scroller.addEventListener('scroll', refreshRange, { passive: true });

  // 回転・画面サイズの変化
  let lastWidth = 0;
  const ro = new ResizeObserver(() => {
    if (scroller.clientWidth === lastWidth) return;
    lastWidth = scroller.clientWidth;
    redrawAll();
  });
  ro.observe(scroller);

  buildViews();
  toolbar.setHistory(false, false);
  refreshRange();

  return async () => {
    ro.disconnect();
    cancelAnimationFrame(rangeFrame);
    for (const v of views) unmount(v);
    await autosave.flush();
    autosave.dispose();
  };
}
