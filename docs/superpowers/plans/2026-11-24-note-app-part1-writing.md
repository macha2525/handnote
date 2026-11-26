# 手書きノート 第1部「書く部分」 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** iPad + Apple Pencil Proで、白紙ノートと取り込んだPDFに手書きでき、本棚で科目ごとに整理でき、すべてiPad内に保存されるオフライン対応Webアプリ（PWA）を作る。

**Architecture:** ビルドツールなしの素のTypeScriptをViteでまとめた1ページアプリ。描画データ（線）はページ座標で保存し、PDFは表示用にPDF.jsで描き、その上に透明キャンバスを重ねて線を描く。保存はIndexedDB。OneDrive同期は第2部で扱うため、保存処理は `storage/db.ts` の関数群だけを通す。

**Tech Stack:** Vite, TypeScript, Vitest, fake-indexeddb, idb, pdfjs-dist, perfect-freehand, vite-plugin-pwa, @fontsource/biz-udpgothic, GitHub Pages（GitHub Actionsで公開）

**Spec:** `docs/2026-11-24-note-app-design.md`

**Execution environment:** 利用者のPC上のClaude Code（npmでのインストールが必要なため）。最終確認は利用者のiPad Proと Apple Pencil Pro の実機で行う。

## Global Constraints

- 料金のかかるサービスや部品を使わない
- アプリにAIを組み込まない
- オフラインで動く（講義中にWi-Fiがなくても書ける）
- ノートの冊数に上限を設けない
- 画面（UI）の色は設計書の6色のみ（ペンのインク色は道具バーの指定に従う）：紙 `#F7F8FA`／墨 `#1F2330`／罫線 `#8FA7C9`／机 `#E3E7EE`／赤ペン `#C8334A`／蛍光 `#F2D35B`
- 書体は BIZ UDPゴシック 1種類。アプリに同梱する
- 文字は左寄せ。ページ（紙）は角を丸めない。ボタンは小さめの丸み
- 動きは操作への反応だけ（自動で動く装飾は入れない）
- 画面の言葉は日本語。ボタンは何が起きるかをそのまま書く（例：「PDFを取り込む」「ページを足す」）
- 線の座標はページ座標で保存する（白紙ページはA4相当 595×842、PDFページはそのPDFのページサイズ）
- 筆圧で線の太さが変わる

## Review Focus

1. **100ページ超・数十MBのPDF** → 落ちずに開ける。画面に見えているページとその前後1ページだけ描く（Task 5でテスト）
2. **iPadの保存容量不足（QuotaExceededError）** → 黙って失敗せず「保存できませんでした。iPadの空き容量を確認してください」と表示し、書いた内容は画面に残す（Task 4でテスト）
3. **書いた直後にアプリを閉じる・切り替える** → 保存待ちの内容がその場で保存される（`visibilitychange` で即保存。Task 4でテスト）
4. **拡大・縮小やiPadの回転** → 線がPDFの文字からずれない（ページ座標で保存しているため。Task 2・5でテスト）
5. **ペンで書いている最中に手のひらや指が触れる** → 一度でもペン入力を検知したら、指では線を引かずスクロール・拡大に使う。PCのマウスは線を引ける（Task 3でテスト）

---

## File Structure

```
src/
  main.ts                 起動、画面の切り替え
  model/types.ts          データの型
  model/ids.ts            ID生成
  storage/db.ts           IndexedDBへの保存・読み込み（第2部で同期を差し込む唯一の入口）
  ink/geometry.ts         線の形の計算（perfect-freehand）
  ink/eraser.ts           消しゴムの当たり判定
  ink/history.ts          元に戻す・やり直す
  ink/input.ts            ペン入力の受け付けと手のひら対策
  ink/render.ts           キャンバスへの描画
  pdf/pdf-doc.ts          PDFの読み込みとページ描画
  editor/editor.ts        ノート編集画面
  editor/toolbar.ts       道具バー
  editor/autosave.ts      自動保存
  shelf/shelf.ts          本棚画面
  shelf/notebook-view.ts  ノートブックの中（回・章の一覧）
  styles/tokens.css       色・文字・角丸の変数
  styles/app.css
tests/                    srcと同じ構成で *.test.ts
public/icons/             ホーム画面用アイコン
.github/workflows/deploy.yml
```

---

### Task 1: 土台とデータ保存

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.ts`, `src/styles/tokens.css`, `src/model/types.ts`, `src/model/ids.ts`, `src/storage/db.ts`
- Test: `tests/storage/db.test.ts`

**Interfaces:**
- Produces（`src/model/types.ts`）:
```ts
type NotebookKind = 'lecture' | 'qualification';
interface Notebook { id: string; title: string; color: string; kind: NotebookKind; createdAt: number; }
interface Section { id: string; notebookId: string; order: number; label: string; } // label: "第1回" / "第1章"
type Background = 'plain' | 'ruled' | 'grid';
interface StrokePoint { x: number; y: number; p: number; } // ページ座標, 筆圧0..1
type InkTool = 'pen' | 'highlighter';
interface Stroke { id: string; tool: InkTool; color: string; size: number; points: StrokePoint[]; }
type PageSource = { type: 'blank' } | { type: 'pdf'; pdfPage: number };
interface Page { id: string; source: PageSource; width: number; height: number; strokes: Stroke[]; }
interface Note { id: string; sectionId: string; title: string; background: Background; pdfId?: string; pages: Page[]; updatedAt: number; }
```
- Produces（`src/model/ids.ts`）: `newId(): string`（`crypto.randomUUID()`）
- Produces（`src/storage/db.ts`）:
  `saveNotebook(n: Notebook): Promise<void>` / `listNotebooks(): Promise<Notebook[]>`（createdAt昇順）
  `saveSection(s: Section): Promise<void>` / `listSections(notebookId: string): Promise<Section[]>`（order昇順）
  `saveNote(n: Note): Promise<void>` / `getNote(id: string): Promise<Note | undefined>` / `listNotes(sectionId: string): Promise<Note[]>`
  `putPdf(data: Blob): Promise<string>` / `getPdf(id: string): Promise<Blob | undefined>`
  `requestPersistentStorage(): Promise<boolean>`（`navigator.storage.persist()` を呼ぶ。無ければfalse）
  `class StorageFullError extends Error`（QuotaExceededErrorをこれに包んで投げる）

- [ ] **Step 1:** `npm create vite@latest`（vanilla-ts）で作り、`vitest fake-indexeddb idb pdfjs-dist perfect-freehand vite-plugin-pwa @fontsource/biz-udpgothic` を入れる。`tokens.css` に Global Constraints の6色を `--paper --ink --rule --desk --redpen --marker` として定義し、`font-family: 'BIZ UDPGothic'` を本文に設定
- [ ] **Step 2: 失敗するテストを書く**（`import 'fake-indexeddb/auto'`）
  - `saves and lists notebooks in creation order`：createdAt 2,1 で保存 → `listNotebooks()` のtitleが作成順
  - `lists sections of one notebook ordered by order`：別ノートブックのSectionが混ざらない
  - `round-trips a note with strokes`：pages[0].strokes[0].points が保存前と `toEqual`
  - `stores and returns a pdf blob`：`putPdf` の戻り値IDで `getPdf` が同じsizeのBlob
  - `has no limit on notebook count`：1000冊保存 → `listNotebooks().length === 1000`
  - `wraps quota errors in StorageFullError`：IDBのputが `DOMException('', 'QuotaExceededError')` を投げるようにモック → `saveNote` が `StorageFullError` でreject
- [ ] **Step 3:** `npx vitest run tests/storage` → FAIL
- [ ] **Step 4:** `db.ts` を `idb` で実装。DB名 `handnote`、ストア `notebooks / sections(index notebookId) / notes(index sectionId) / pdfs`
- [ ] **Step 5:** `npx vitest run tests/storage` → PASS
- [ ] **Step 6:** `git commit -m "feat: project scaffold and local storage"`

---

### Task 2: 線の形・消しゴム・元に戻す

**Files:**
- Create: `src/ink/geometry.ts`, `src/ink/eraser.ts`, `src/ink/history.ts`
- Test: `tests/ink/geometry.test.ts`, `tests/ink/eraser.test.ts`, `tests/ink/history.test.ts`

**Interfaces:**
- Consumes: `Stroke`, `StrokePoint`（Task 1）
- Produces:
  `strokeOutline(stroke: Stroke): [number, number][]`（perfect-freehand `getStroke`、`size: stroke.size`、`simulatePressure: false`、`thinning: 0.6`。蛍光ペンは `thinning: 0` で筆圧無視）
  `toScreen(pt: StrokePoint, scale: number): {x: number, y: number}` / `toPage(x: number, y: number, scale: number, p: number): StrokePoint`
  `strokeHit(stroke: Stroke, pt: {x: number, y: number}, radius: number): boolean`（いずれかの線分までの距離 ≤ radius + stroke.size/2）
  `eraseAt(strokes: Stroke[], pt: {x:number,y:number}, radius: number): { kept: Stroke[]; removed: Stroke[] }`
  `class History { push(op: InkOp): void; undo(strokes: Stroke[]): Stroke[]; redo(strokes: Stroke[]): Stroke[]; canUndo(): boolean; canRedo(): boolean; }`
  `type InkOp = { kind: 'add'; stroke: Stroke } | { kind: 'remove'; strokes: Stroke[] }`（上限200手。新しい操作でredoは消える）

- [ ] **Step 1: 失敗するテストを書く**
  - `higher pressure makes a wider outline`：同じ点列で p=0.2 と p=0.9 → 0.9 の外形の幅（bbox短辺）が大きい
  - `highlighter ignores pressure`：p=0.2 と 0.9 で外形の幅が同じ（誤差1未満）
  - `page/screen conversion round-trips at any zoom`：scale 0.5, 1, 2.75 で `toPage(toScreen(pt))` が元の点と一致（Review Focus 4）
  - `strokeHit true near a segment, false far away`
  - `eraseAt removes whole strokes only`：3本中1本に当たる → kept 2本、removed 1本、keptの点列は無変更
  - `undo of add removes the stroke; redo restores it`
  - `undo of erase restores removed strokes`
  - `new op clears redo`
- [ ] **Step 2:** `npx vitest run tests/ink` → FAIL
- [ ] **Step 3:** 3ファイルを実装
- [ ] **Step 4:** `npx vitest run tests/ink` → PASS
- [ ] **Step 5:** `git commit -m "feat: ink geometry, eraser, undo history"`

---

### Task 3: ペン入力と手のひら対策

**Files:**
- Create: `src/ink/input.ts`
- Test: `tests/ink/input.test.ts`

**Interfaces:**
- Consumes: `toPage`（Task 2）
- Produces:
  `interface InputState { penSeen: boolean; }`
  `decidePointer(e: { pointerType: string; isPrimary: boolean }, state: InputState): 'draw' | 'navigate' | 'ignore'`
  `attachInkInput(el: HTMLElement, opts: { getScale(): number; onStrokeStart(p: StrokePoint): void; onStrokeMove(p: StrokePoint): void; onStrokeEnd(): void; }): () => void`（解除関数を返す。`getCoalescedEvents()` があれば全点を使う。`pressure` が0のマウスは0.5とする。`el` に `touch-action` を、penSeen後は `pan-x pan-y pinch-zoom` に設定）

- [ ] **Step 1: 失敗するテストを書く**（Review Focus 5）
  - `pen always draws`
  - `touch draws before any pen is seen`（ペンを持っていない時に指で書ける）
  - `touch navigates once a pen has been seen`
  - `mouse draws on PC`
  - `non-primary touch is ignored for drawing`（2本指は拡大用）
- [ ] **Step 2:** `npx vitest run tests/ink/input.test.ts` → FAIL
- [ ] **Step 3:** 実装。`decidePointer` で pen を受けたら `state.penSeen = true`
- [ ] **Step 4:** → PASS
- [ ] **Step 5:** `git commit -m "feat: pencil input with palm rejection"`

---

### Task 4: 白紙ノートの編集画面と自動保存

**Files:**
- Create: `src/ink/render.ts`, `src/editor/editor.ts`, `src/editor/toolbar.ts`, `src/editor/autosave.ts`, `src/styles/app.css`
- Test: `tests/editor/autosave.test.ts`, `tests/ink/render.test.ts`

**Interfaces:**
- Consumes: Task 1〜3 のすべて
- Produces:
  `drawPage(ctx: CanvasRenderingContext2D, page: Page, background: Background, scale: number): void`（背景→蛍光ペン→ペンの順。罫線は8mm間隔＝22.7pt、方眼は5mm＝14.2pt、色 `--rule`）
  `createAutosave(save: (n: Note) => Promise<void>, opts?: { delayMs?: number }): { schedule(n: Note): void; flush(): Promise<void>; onError(cb: (e: Error) => void): void }`（既定 delayMs 1500）
  `openEditor(root: HTMLElement, noteId: string): Promise<void>`
- 道具バーの中身（左から）：ペン（墨・赤ペン・`#2F6FB3`の3色、太さ3段階 1.5/2.5/4）、蛍光ペン（蛍光色、太さ14、不透明度0.35）、消しゴム（半径10）、元に戻す、やり直す、「ページを足す」。暗記ペン・暗記マーカーは第3部
- 縦スクロールでページが並ぶ。指2本で拡大・縮小（0.5〜3倍）

- [ ] **Step 1: 失敗するテストを書く**（vi.useFakeTimers）
  - `saves once after the delay even with many edits`：100msおきに10回 schedule → 1500ms後に save 1回、最後の内容
  - `flush saves immediately`
  - `flush runs when the page becomes hidden`：`document.visibilityState='hidden'` + `visibilitychange` 発火 → save 呼ばれる（Review Focus 3）
  - `reports StorageFullError and keeps the note`：saveが `StorageFullError` → onError に渡る、次の schedule で再試行される（Review Focus 2）
  - `drawPage draws highlighter before pen`：モックctxの呼び出し順で、蛍光ペンの fill が先
- [ ] **Step 2:** `npx vitest run tests/editor tests/ink/render.test.ts` → FAIL
- [ ] **Step 3:** `autosave.ts` と `render.ts` を実装
- [ ] **Step 4:** → PASS
- [ ] **Step 5:** `editor.ts` と `toolbar.ts` を実装。保存失敗時は画面上部に「保存できませんでした。iPadの空き容量を確認してください」を出す（自動では消さない、次の保存成功で消える）
- [ ] **Step 6:** `npm run dev -- --host` で起動し、同じWi-FiのiPadのSafariで開いて確認：Pencilで筆圧が効く／手のひらを置いても線が出ない／消しゴム・元に戻す・やり直す・ページを足すが動く／再読み込みしても線が残る
- [ ] **Step 7:** `git commit -m "feat: blank note editor with autosave"`

---

### Task 5: PDFノート

**Files:**
- Create: `src/pdf/pdf-doc.ts`
- Modify: `src/editor/editor.ts`
- Test: `tests/pdf/pdf-doc.test.ts`, `tests/editor/visible-pages.test.ts`

**Interfaces:**
- Consumes: `putPdf/getPdf`（Task 1）、`drawPage`（Task 4）
- Produces:
  `openPdf(data: Blob): Promise<{ pageCount: number; pageSize(n: number): { width: number; height: number }; renderPage(n: number, canvas: HTMLCanvasElement, scale: number): Promise<void>; }>`（1始まり。workerはpdfjs-distのものを同梱）
  `createPdfNote(sectionId: string, data: Blob, title: string): Promise<Note>`（PDFのページ数だけ `{type:'pdf'}` のPageを作り、width/heightはPDFのサイズ）
  `insertBlankPageAfter(note: Note, index: number): Note`（直前ページと同じ大きさの白紙）
  `visiblePageRange(scrollTop: number, viewportH: number, pageTops: number[], pageHeights: number[]): [number, number]`（見えている範囲の前後1ページを含む）

- [ ] **Step 1: 失敗するテストを書く**
  - `createPdfNote makes one page per pdf page with pdf sizes`：テスト用の3ページPDF（`tests/fixtures/three-pages.pdf`、A4とレター混在）
  - `insertBlankPageAfter keeps page order and size`
  - `visiblePageRange includes one page before and after`
  - `visiblePageRange on a 300-page document returns a small range`：範囲の幅 ≤ 5（Review Focus 1）
- [ ] **Step 2:** `npx vitest run tests/pdf tests/editor/visible-pages.test.ts` → FAIL
- [ ] **Step 3:** 実装。PDFページの描画キャンバスは範囲外になったら破棄する
- [ ] **Step 4:** → PASS
- [ ] **Step 5:** 編集画面に「PDFを取り込む」を追加（`<input type="file" accept="application/pdf">`、iPadのファイルアプリやOneDriveから選べる）。PDFの下にPDF.js、上に線のキャンバスを重ねる
- [ ] **Step 6:** iPad実機で確認：講義スライドのPDFに書ける／拡大・回転しても線が文字からずれない（Review Focus 4）／100ページ以上のPDFでも落ちない（Review Focus 1）
- [ ] **Step 7:** `git commit -m "feat: annotate imported pdfs"`

---

### Task 6: 本棚とノートブックの中

**Files:**
- Create: `src/shelf/shelf.ts`, `src/shelf/notebook-view.ts`
- Modify: `src/main.ts`
- Test: `tests/shelf/labels.test.ts`

**Interfaces:**
- Consumes: Task 1 のstorage関数、`openEditor`（Task 4）、`createPdfNote`（Task 5）
- Produces:
  `nextSectionLabel(kind: NotebookKind, existing: Section[]): { order: number; label: string }`（lecture→「第n回」、qualification→「第n章」。nは既存orderの最大+1）
  `NOTEBOOK_COLORS: { bg: string; text: string }[]`（背表紙の色。墨・赤ペン・罫線・蛍光・机の5色。文字色は紙か墨のうちコントラストが4.5:1以上になるほう）
- 本棚：背表紙を左寄せで横に並べる。背表紙に科目名を縦書き（`writing-mode: vertical-rl`）。右上に「新しいノートブック」。作るときは科目名・種類（講義／資格）・色を選ぶ
- ノートブックの中：回・章が番号順に縦に並ぶ。各行に「白紙ノートを作る」「PDFを取り込む」。中のノートをタップで編集画面
- 何もないときの本棚：「まだノートブックがありません。科目ごとに1冊作りましょう」と「新しいノートブック」ボタン

- [ ] **Step 1: 失敗するテストを書く**
  - `lecture notebooks number sessions as 第n回`
  - `qualification notebooks number chapters as 第n章`
  - `next label follows the highest existing order even with gaps`：order 1,2,5 → 第6回
  - `notebook colors meet 4.5:1 contrast with their label text`：全5色で bg と text のコントラスト比 ≥ 4.5
- [ ] **Step 2:** `npx vitest run tests/shelf` → FAIL
- [ ] **Step 3:** 実装
- [ ] **Step 4:** → PASS
- [ ] **Step 5:** 画面で確認：ノートブックを作る→回を足す→白紙ノートとPDFノートを作る→本棚に戻る、が一通りできる
- [ ] **Step 6:** `git commit -m "feat: bookshelf and sessions"`

---

### Task 7: オフライン対応と公開

**Files:**
- Modify: `vite.config.ts`, `src/main.ts`
- Create: `public/icons/icon-192.png`, `public/icons/icon-512.png`, `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `requestPersistentStorage`（Task 1）

- [ ] **Step 1:** `vite-plugin-pwa` を設定（名前「ノート」、`display: 'standalone'`、`theme_color: '#F7F8FA'`、フォント・PDF.jsのworkerを含む全ファイルを事前キャッシュ）。`base` はGitHub Pagesのリポジトリ名に合わせる
- [ ] **Step 2:** 起動時に `requestPersistentStorage()` を呼ぶ
- [ ] **Step 3:** `npm run build && npx vitest run` → ビルド成功、全テストPASS
- [ ] **Step 4:** GitHub Actionsで `main` へのpush時に `dist` をGitHub Pagesへ公開するworkflowを作り、利用者のGitHubアカウントのリポジトリにpush
- [ ] **Step 5:** iPad実機で最終確認：公開URLをSafariで開いて「ホーム画面に追加」／機内モードにしてもホーム画面から起動して書ける／書いた内容が再起動後も残る
- [ ] **Step 6:** `git commit -m "feat: offline pwa and github pages deploy"`
