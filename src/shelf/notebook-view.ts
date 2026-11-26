import type { Background, Note, Section } from '../model/types';
import { A4 } from '../model/types';
import { newId } from '../model/ids';
import {
  deleteNote, deleteNotebook, deleteSection, getNotebook, listNotes, listSections, saveNote, saveSection,
  StorageFullError,
} from '../storage/db';
import { createPdfNote } from '../pdf/pdf-doc';
import { nextSectionLabel, textColorFor } from './labels';
import { btn, confirmDanger, el } from './shelf';

const BACKGROUNDS: { value: Background; name: string }[] = [
  { value: 'plain', name: '無地' },
  { value: 'ruled', name: '罫線' },
  { value: 'grid', name: '方眼' },
];

export function newBlankNote(sectionId: string, title: string, background: Background): Note {
  return {
    id: newId(), sectionId, title, background, updatedAt: Date.now(),
    pages: [{ id: newId(), source: { type: 'blank' }, width: A4.width, height: A4.height, strokes: [] }],
  };
}

/** PDFファイルからPDFノートを作って保存する。失敗したら利用者向けの文言で投げ直す */
export async function importPdfNote(sectionId: string, file: File): Promise<Note> {
  try {
    const note = await createPdfNote(sectionId, file, file.name.replace(/\.pdf$/i, ''));
    await saveNote(note);
    return note;
  } catch (e) {
    if (e instanceof StorageFullError) throw e;
    throw new Error('PDFを読み込めませんでした。ファイルが壊れていないか確認してください');
  }
}

/** ノートブックの中：回・章を番号順に並べ、それぞれにノートを作る */
export async function openNotebookView(root: HTMLElement, notebookId: string, nav: {
  openShelf(): void;
  openNote(id: string): void;
}): Promise<void> {
  const nb = await getNotebook(notebookId);
  if (!nb) { nav.openShelf(); return; }

  root.replaceChildren();
  root.className = 'screen notebook';

  const header = el('header', 'bar');
  header.style.setProperty('--bg', nb.color);
  header.style.setProperty('--fg', textColorFor(nb.color));
  const unit = nb.kind === 'lecture' ? '回' : '章';
  header.append(
    btn('本棚に戻る', nav.openShelf),
    el('h1', 'bar-title', nb.title),
    btn(`${unit}を足す`, () => addSection(), 'btn btn-primary'),
    btn('ノートブックを削除', () => removeNotebook(), 'btn btn-danger-quiet'),
  );
  const status = el('div', 'status');
  status.setAttribute('role', 'status');
  const list = el('main', 'sections');
  root.append(header, status, list);

  const fileInput = el('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/pdf';
  fileInput.hidden = true;
  let pdfTarget: Section | null = null;
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files?.[0];
    fileInput.value = '';
    if (!f || !pdfTarget) return;
    status.textContent = 'PDFを読み込んでいます…';
    try {
      const note = await importPdfNote(pdfTarget.id, f);
      nav.openNote(note.id);
    } catch (e) {
      status.textContent = (e as Error).message;
    }
  });
  root.append(fileInput);

  let sections = await listSections(notebookId);

  async function addSection() {
    const { order, label } = nextSectionLabel(nb!.kind, sections);
    const s: Section = { id: newId(), notebookId, order, label };
    try {
      await saveSection(s);
    } catch (e) {
      status.textContent = (e as Error).message;
      return;
    }
    sections = [...sections, s];
    await render();
    list.lastElementChild?.scrollIntoView({ block: 'nearest' });
  }

  async function removeNotebook() {
    const ok = await confirmDanger(root, {
      title: 'ノートブックを削除',
      message: `「${nb!.title}」を削除します。中のすべての${unit}とノートも消え、元に戻せません。`,
      ok: '削除する',
    });
    if (!ok) return;
    try {
      await deleteNotebook(notebookId);
      nav.openShelf();
    } catch (e) {
      status.textContent = (e as Error).message;
    }
  }

  async function removeSection(s: Section, noteCount: number) {
    const inside = noteCount ? `中のノート${noteCount}冊も消え、` : '';
    const ok = await confirmDanger(root, {
      title: `${s.label}を削除`,
      message: `「${s.label}」を削除します。${inside}元に戻せません。`,
      ok: '削除する',
    });
    if (!ok) return;
    try {
      await deleteSection(s.id);
    } catch (e) {
      status.textContent = (e as Error).message;
      return;
    }
    sections = sections.filter(x => x.id !== s.id);
    await render();
  }

  async function removeNote(n: Note) {
    const ok = await confirmDanger(root, {
      title: 'ノートを削除',
      message: `「${n.title}」を削除します。書いた内容も消え、元に戻せません。`,
      ok: '削除する',
    });
    if (!ok) return;
    try {
      await deleteNote(n.id);
    } catch (e) {
      status.textContent = (e as Error).message;
      return;
    }
    await render();
  }

  async function render() {
    list.replaceChildren();
    if (sections.length === 0) {
      const empty = el('div', 'empty');
      empty.append(el('p', '', `まだ${unit}がありません。「${unit}を足す」で第1${unit}を作りましょう`));
      list.append(empty);
      return;
    }
    for (const s of sections) list.append(await sectionRow(s));
  }

  async function sectionRow(s: Section): Promise<HTMLElement> {
    const row = el('section', 'section-row');
    row.append(el('h2', 'section-label', s.label));

    const notes = await listNotes(s.id);
    const ul = el('ul', 'note-list');
    for (const n of notes) {
      const li = el('li', 'note-item');
      const del = btn('削除', () => removeNote(n), 'btn btn-small btn-danger-quiet');
      del.setAttribute('aria-label', `${n.title}を削除`);
      li.append(btn(n.title, () => nav.openNote(n.id), 'note-link'), del);
      ul.append(li);
    }
    row.append(ul);

    const actions = el('div', 'actions');
    const chooser = el('div', 'bg-chooser');
    chooser.hidden = true;
    chooser.append(el('span', '', '紙の種類：'));
    for (const b of BACKGROUNDS) {
      chooser.append(btn(b.name, async () => {
        const title = notes.length ? `${s.label} (${notes.length + 1})` : s.label;
        const note = newBlankNote(s.id, title, b.value);
        try {
          await saveNote(note);
          nav.openNote(note.id);
        } catch (e) {
          status.textContent = (e as Error).message;
        }
      }));
    }
    actions.append(
      btn('白紙ノートを作る', () => { chooser.hidden = !chooser.hidden; }),
      btn('PDFを取り込む', () => { pdfTarget = s; fileInput.click(); }),
      btn(`この${unit}を削除`, () => removeSection(s, notes.length), 'btn btn-danger-quiet'),
    );
    row.append(actions, chooser);
    return row;
  }

  await render();
}
