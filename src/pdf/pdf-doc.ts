import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { Note, Page } from '../model/types';
import { newId } from '../model/ids';
import { putPdf } from '../storage/db';

export interface PdfDoc {
  pageCount: number;
  /** 1始まり。PDFのページサイズ（pt、回転を反映） */
  pageSize(n: number): { width: number; height: number };
  renderPage(n: number, canvas: HTMLCanvasElement, scale: number): Promise<void>;
  destroy(): Promise<void>;
}

/** 起動時に一度だけ呼ぶ。workerはアプリに同梱したファイルを使う（オフライン対応） */
export function configurePdfWorker(workerUrl: string): void {
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
}

async function bytes(b: Blob): Promise<Uint8Array> {
  if (typeof b.arrayBuffer === 'function') return new Uint8Array(await b.arrayBuffer());
  return new Uint8Array(await new Response(b).arrayBuffer());
}

/**
 * opts.sizes=false のときはページサイズを先に読まない（編集画面ではノートに保存済みのため。
 * 数百ページのPDFでも開くのが速い）。
 */
export async function openPdf(data: Blob, opts?: { sizes?: boolean }): Promise<PdfDoc> {
  const loading = pdfjs.getDocument({ data: await bytes(data) });
  const doc = await loading.promise;
  const sizes: { width: number; height: number }[] = [];
  for (let i = 1; opts?.sizes !== false && i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    sizes.push({ width: vp.width, height: vp.height });
    page.cleanup();
  }
  const tasks = new WeakMap<HTMLCanvasElement, { cancel(): void }>();

  return {
    pageCount: doc.numPages,
    pageSize: n => sizes[n - 1],
    async renderPage(n, canvas, scale) {
      tasks.get(canvas)?.cancel();
      const page = await doc.getPage(n);
      const vp = page.getViewport({ scale });
      canvas.width = Math.max(1, Math.round(vp.width));
      canvas.height = Math.max(1, Math.round(vp.height));
      const task = page.render({ canvas, viewport: vp } as Parameters<typeof page.render>[0]);
      tasks.set(canvas, task);
      try {
        await task.promise;
      } finally {
        if (tasks.get(canvas) === task) tasks.delete(canvas);
        page.cleanup();
      }
    },
    destroy: () => loading.destroy(),
  };
}

/** PDFのページ数だけページを作る。PDF本体は putPdf で保存する。 */
export async function createPdfNote(sectionId: string, data: Blob, title: string): Promise<Note> {
  const doc = await openPdf(data);
  const pages: Page[] = [];
  for (let n = 1; n <= doc.pageCount; n++) {
    const { width, height } = doc.pageSize(n);
    pages.push({ id: newId(), source: { type: 'pdf', pdfPage: n }, width, height, strokes: [] });
  }
  await doc.destroy();
  const pdfId = await putPdf(data);
  return { id: newId(), sectionId, title, background: 'plain', pdfId, pages, updatedAt: Date.now() };
}

/** index のページの後ろに、同じ大きさの白紙ページを入れる。元の note は変えない。 */
export function insertBlankPageAfter(note: Note, index: number): Note {
  const ref = note.pages[index] ?? note.pages[note.pages.length - 1];
  const blank: Page = {
    id: newId(), source: { type: 'blank' },
    width: ref?.width ?? 595, height: ref?.height ?? 842, strokes: [],
  };
  const at = Math.min(Math.max(index + 1, 0), note.pages.length);
  return { ...note, pages: [...note.pages.slice(0, at), blank, ...note.pages.slice(at)] };
}

/** 見えているページと、その前後1ページの範囲 [最初, 最後]（0始まり） */
export function visiblePageRange(scrollTop: number, viewportH: number, pageTops: number[], pageHeights: number[]): [number, number] {
  const n = pageTops.length;
  if (n === 0) return [0, -1];
  const bottom = scrollTop + viewportH;
  // 下端が scrollTop より下にある最初のページ
  let lo = 0, hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (pageTops[mid] + pageHeights[mid] > scrollTop) hi = mid; else lo = mid + 1;
  }
  const first = lo;
  // 上端が画面の下端より上にある最後のページ
  lo = first; hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (pageTops[mid] < bottom) lo = mid; else hi = mid - 1;
  }
  const last = Math.max(first, lo);
  return [Math.max(0, first - 1), Math.min(n - 1, last + 1)];
}
