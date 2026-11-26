import type { Notebook, NotebookKind } from '../model/types';
import { newId } from '../model/ids';
import { listNotebooks, saveNotebook } from '../storage/db';
import { NOTEBOOK_COLORS, spineTone } from './labels';

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

export function btn(label: string, onClick: () => void, cls = 'btn'): HTMLButtonElement {
  const b = el('button', cls, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

/** 削除などの確認。「削除する」を押したら true */
export function confirmDanger(root: HTMLElement, opts: { title: string; message: string; ok: string }): Promise<boolean> {
  return new Promise(resolve => {
    const dlg = el('dialog', 'dialog');
    let result = false;
    dlg.append(el('h2', '', opts.title), el('p', 'dialog-message', opts.message));
    const actions = el('div', 'actions');
    const cancel = btn('やめる', () => dlg.close());
    actions.append(
      btn(opts.ok, () => { result = true; dlg.close(); }, 'btn btn-danger'),
      cancel,
    );
    dlg.append(actions);
    dlg.addEventListener('close', () => { dlg.remove(); resolve(result); });
    root.append(dlg);
    dlg.showModal();
    cancel.focus(); // 誤って決定しないよう、最初は「やめる」に合わせる
  });
}

/** 本棚：ノートブックを背表紙のように左寄せで並べる */
export async function openShelf(root: HTMLElement, nav: { openNotebook(id: string): void }): Promise<void> {
  root.replaceChildren();
  root.className = 'screen shelf';
  const notebooks = await listNotebooks();

  const header = el('header', 'bar');
  header.append(el('h1', 'bar-title', '本棚'), btn('新しいノートブック', () => showCreate(), 'btn btn-primary'));
  root.append(header);

  const body = el('main', 'shelf-body');
  root.append(body);

  if (notebooks.length === 0) {
    const empty = el('div', 'empty');
    empty.append(el('p', '', 'まだノートブックがありません。科目ごとに1冊作りましょう'),
      btn('新しいノートブック', () => showCreate(), 'btn btn-primary'));
    body.append(empty);
  } else {
    const row = el('div', 'spines');
    for (const nb of notebooks) row.append(spine(nb, () => nav.openNotebook(nb.id)));
    body.append(row);
  }

  function showCreate() {
    const dlg = el('dialog', 'dialog');
    const form = el('form');
    form.method = 'dialog';
    form.append(el('h2', '', '新しいノートブック'));

    const titleLabel = el('label', 'field');
    titleLabel.append(el('span', '', '科目名'));
    const title = el('input');
    title.required = true;
    title.maxLength = 60;
    title.placeholder = '例：統計学入門';
    titleLabel.append(title);

    const kindSet = el('fieldset', 'field');
    kindSet.append(el('legend', '', '種類'));
    let kind: NotebookKind = 'lecture';
    for (const [k, name] of [['lecture', '講義（第1回、第2回…）'], ['qualification', '資格（第1章、第2章…）']] as const) {
      const l = el('label', 'choice');
      const r = el('input');
      r.type = 'radio'; r.name = 'kind'; r.value = k; r.checked = k === kind;
      r.addEventListener('change', () => { kind = k; });
      l.append(r, document.createTextNode(name));
      kindSet.append(l);
    }

    const colorSet = el('fieldset', 'field');
    colorSet.append(el('legend', '', '色'));
    let color = NOTEBOOK_COLORS[0].bg;
    const swatches = el('div', 'swatches');
    for (const c of NOTEBOOK_COLORS) {
      const l = el('label', 'swatch');
      l.style.setProperty('--bg', c.bg);
      l.title = c.name;
      const r = el('input');
      r.type = 'radio'; r.name = 'color'; r.value = c.bg; r.checked = c.bg === color;
      r.setAttribute('aria-label', c.name);
      r.addEventListener('change', () => { color = c.bg; });
      l.append(r);
      swatches.append(l);
    }
    colorSet.append(swatches);

    const actions = el('div', 'actions');
    const cancel = btn('やめる', () => dlg.close());
    const ok = el('button', 'btn btn-primary', '作る');
    ok.type = 'submit';
    actions.append(ok, cancel);

    form.append(titleLabel, kindSet, colorSet, actions);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const t = title.value.trim();
      if (!t) { title.focus(); return; }
      const nb: Notebook = { id: newId(), title: t, color, kind, createdAt: Date.now() };
      await saveNotebook(nb);
      dlg.close();
      nav.openNotebook(nb.id);
    });
    dlg.addEventListener('close', () => dlg.remove());
    dlg.append(form);
    root.append(dlg);
    dlg.showModal();
    title.focus();
  }
}

function spine(nb: Notebook, onOpen: () => void): HTMLButtonElement {
  const b = btn('', onOpen, 'spine');
  b.style.setProperty('--bg', spineTone(nb.color).bg);
  b.style.setProperty('--fg', spineTone(nb.color).text);
  b.setAttribute('aria-label', `${nb.title}を開く`);
  b.append(el('span', 'spine-title', nb.title));
  return b;
}
