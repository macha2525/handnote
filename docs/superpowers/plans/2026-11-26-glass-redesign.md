# デザイン刷新（F：深い藍の書斎） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** アプリ全体の見た目を、見本 F（深い藍の机＋本物のすりガラス＋しっぽり明朝の見出し）に置き換える。機能は変えない。

**Architecture:** 色・文字・ガラスの値を `src/styles/tokens.css` に集め、各画面のCSSはトークンだけを使う。ガラスは `.glass` 系の共通ルール1か所で作り、ぼかしの有無は `--glass-blur` 1つで切り替える。アイコンは `src/ui/icons.ts` にまとめ、ボタン名は aria-label に残す。

**Tech Stack:** TypeScript, Vite, CSS（backdrop-filter）, @fontsource/shippori-mincho-b1, vitest, Playwright（見た目の確認）

**Spec:** docs/superpowers/specs/2026-11-26-glass-redesign-design.md

## Global Constraints

- 机：#0C1224 の上に #24407A（右上）、#1B2E5C（左下）、#3A2F55（中央、うっすら）のにじみ
- ガラス：塗り rgb(16 24 48 / 0.45)、ぼかし 22px、ふち rgb(200 215 245 / 0.2)、上のふちに淡い光
- ガラスの上の文字 #E6ECF5、選択中は真鍮 #C9A86A（その上の文字 #0C1224）
- 紙・罫線・書いた線の色は変えない（render.ts / colors.ts の紙と線の色に触れない）
- 見出し・背表紙：'Shippori Mincho B1' 700（同梱、オフラインで出る）
- 本文：'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', 'YuGothic', sans-serif。BIZ UDPゴシックは外す
- テーマは1種類（暗い F のみ）
- 機能・ボタンの役割は変えない。aria-label は今の文言を保つ（既存テストとブラウザ確認が頼っている）

## Review Focus

- ぼかし非対応の環境：`@supports not (backdrop-filter: blur(1px))` で塗りを濃くし、文字が読めること（Task 1 の CSS で対応、Task 5 で表示確認）
- 横幅1024pxで道具バーが1段に収まること（Task 3 の確認手順で幅を測る）
- 既存ノートブックの古い色（#1F2330 など）が新しい色に読み替わり、背表紙の文字が読めること（Task 2 のテスト）
- 暗い机の上の白い紙と、ガラスの道具バーが重なったとき、バーの文字が読めること（Task 3 の確認で目視）
- 書いている最中の線が遅れないこと：紙（.page / canvas）には backdrop-filter を使わない（Task 3 の確認で CSS を検索）

---

### Task 1: 色・文字・ガラスの土台

**Files:**
- Modify: `src/styles/tokens.css`（全面）
- Modify: `package.json`（@fontsource/biz-udpgothic → @fontsource/shippori-mincho-b1）
- Modify: `src/styles/app.css`（先頭の共通部分に `.glass` 系を追加）

**Interfaces:**
- Produces: CSS 変数 `--desk-bg`, `--glass-fill`, `--glass-blur`, `--glass-edge`, `--glass-hi`, `--glass-shadow`, `--on-glass`, `--on-glass-muted`, `--brass`, `--on-brass`, `--paper`, `--ink`, `--redpen`, `--font`, `--font-display`, `--radius-pill`, `--radius-panel`。共通クラス `.glass`（ガラスの面）と `.glass-btn`（ガラス上のボタン、`.is-on` で真鍮）

- [ ] Step 1: `npm uninstall @fontsource/biz-udpgothic && npm install @fontsource/shippori-mincho-b1`
- [ ] Step 2: tokens.css を書き換え（値は Global Constraints のとおり。`--paper`/`--ink`/`--rule`/`--redpen`/`--marker` は今の値を残す）。`body` に机の背景と文字色・本文フォント
- [ ] Step 3: app.css に `.glass`（塗り・ぼかし・ふち・上の光・影）と `.glass-btn` を追加。`@supports not (backdrop-filter …)` で塗りを rgb(16 24 48 / 0.92) に
- [ ] Step 4: `npm run build` が通ること、`npx vitest run` が全部通ること
- [ ] Step 5: Commit `style: deep indigo glass design tokens and display font`

### Task 2: 本棚の色の読み替え

**Files:**
- Modify: `src/shelf/labels.ts`
- Test: `tests/shelf/labels.test.ts`

**Interfaces:**
- Produces: `NOTEBOOK_COLORS: { bg: string; name: string }[]`（新しい5色、藍の机で映える色）、`spineTone(stored: string): { bg: string; text: string }`（古い色も新しい色も受け、背表紙の塗り色と文字色を返す）。`textColorFor` は `spineTone(x).text` に置き換える

- [ ] Step 1: テストを書く
  - `spineTone('#1F2330')`（古い墨）が新しい5色のどれかの bg を返す。古い5色すべてで同様
  - 新しい5色それぞれ、`spineTone(c.bg).text` と bg のコントラストが 4.5 以上
  - 知らない色（'#123456'）でも bg と読める文字色を返す
- [ ] Step 2: 失敗を確認 `npx vitest run tests/shelf/labels.test.ts`
- [ ] Step 3: 実装。新しい5色：藍 #2E4B8A、葡萄 #5A4A7E、真鍮 #B8955A、青磁 #4F7F80、臙脂 #8A3A45。古い色の対応：墨→藍、赤→臙脂、青→青磁、黄→真鍮、灰→葡萄
- [ ] Step 4: テストが通ること
- [ ] Step 5: Commit `style: notebook colors for the indigo desk, map old colors`

### Task 3: ノート画面（浮かぶ道具バー・パネル・お知らせ）

**Files:**
- Create: `src/ui/icons.ts`
- Modify: `src/editor/toolbar.ts`（ボタンの見た目とアイコン、構造は保つ）
- Modify: `src/editor/editor.ts`（道具バーを紙の上に重ねる配置だけ）
- Modify: `src/styles/app.css`（道具バー・ペン立て・調整パネル・お知らせ・ページ）

**Interfaces:**
- Produces: `icon(name: 'back' | 'undo' | 'redo' | 'plus' | 'page-add' | 'pdf'): SVGSVGElement`（線のアイコン、currentColor）

- [ ] Step 1: icons.ts を作る（24×24、線幅1.8、丸い線端）
- [ ] Step 2: toolbar.ts の戻る・元に戻す・やり直す・ページを足す・PDFを取り込む・＋をアイコンに。aria-label/title は今の文言のまま。ペン立ての選択中は真鍮
- [ ] Step 3: editor.ts：道具バーを `.pages` の上に重ねる（`position: absolute` の帯、上と左右に余白）。`.pages-inner` の上の余白を道具バーの高さぶん足し、ページがバーの下から透けて見えるようにする
- [ ] Step 4: CSS：机は Task 1 の背景、紙は今の色で影を深く、`.page` と canvas には backdrop-filter を使わない
- [ ] Step 5: `npx vitest run` が全部通ること。`grep -n backdrop src/styles/app.css` で紙に使っていないこと
- [ ] Step 6: Playwright で 1024×768 と 1180×820 の編集画面を撮り、道具バーが1段か確認（`.toolbar` の高さ < 70px）。2段なら「ページを足す」「PDFを取り込む」を「その他」メニューにまとめる
- [ ] Step 7: Commit `style: floating glass toolbar and panels in the editor`

### Task 4: 本棚・ノートブックの中・確認画面

**Files:**
- Modify: `src/shelf/shelf.ts`（背表紙に spineTone、見出しの class）
- Modify: `src/shelf/notebook-view.ts`（見出しの class、色の読み替え）
- Modify: `src/styles/app.css`（.bar, .btn 系, 本棚, 背表紙, ダイアログ, 回の一覧）

- [ ] Step 1: 上の帯をガラスに、見出しは `--font-display`。背表紙は半透明の色ガラス＋しっぽり明朝の縦書き
- [ ] Step 2: ダイアログをガラスに、背景の暗幕を藍に。危険ボタンは臙脂（#8A3A45 系、白文字で 4.5 以上）
- [ ] Step 3: 回の一覧はガラスの板を縦に並べる
- [ ] Step 4: `npx vitest run` が通ること
- [ ] Step 5: Commit `style: glass shelf, notebook view and dialogs`

### Task 5: 通しの確認

- [ ] Step 1: `npm run build`
- [ ] Step 2: Playwright で本棚・ノートブックの中・ノート画面・ペン調整パネル・削除確認を撮影（1024×768）。ぼかしを切った状態（`backdrop-filter: none` を注入）でも文字が読めるか1枚
- [ ] Step 3: 既存のブラウザ確認（削除・部分消し・ペン立て・2本指タップ）を流し直して壊れていないこと
- [ ] Step 4: 作業ブランチに push。公開は利用者の返事を待つ
