export type NotebookKind = 'lecture' | 'qualification';
export interface Notebook { id: string; title: string; color: string; kind: NotebookKind; createdAt: number; }
/** label: "第1回" / "第1章" */
export interface Section { id: string; notebookId: string; order: number; label: string; }
export type Background = 'plain' | 'ruled' | 'grid';
/** ページ座標, 筆圧 p は 0..1 */
export interface StrokePoint { x: number; y: number; p: number; }
export type InkTool = 'pen' | 'highlighter';
export interface Stroke { id: string; tool: InkTool; color: string; size: number; points: StrokePoint[]; }
export type PageSource = { type: 'blank' } | { type: 'pdf'; pdfPage: number };
export interface Page { id: string; source: PageSource; width: number; height: number; strokes: Stroke[]; }
export interface Note { id: string; sectionId: string; title: string; background: Background; pdfId?: string; pages: Page[]; updatedAt: number; }

/** 白紙ページの大きさ（A4相当, pt） */
export const A4 = { width: 595, height: 842 } as const;
