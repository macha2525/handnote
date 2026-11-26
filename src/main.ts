import './styles/tokens.css';
import './styles/app.css';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { configurePdfWorker } from './pdf/pdf-doc';
import { getNote, getSection, requestPersistentStorage } from './storage/db';
import { openShelf } from './shelf/shelf';
import { openNotebookView, importPdfNote } from './shelf/notebook-view';
import { openEditor } from './editor/editor';

configurePdfWorker(pdfWorkerUrl);

const root = document.getElementById('app')!;
let cleanup: (() => Promise<void>) | null = null;

const go = {
  shelf: () => { location.hash = '#/'; },
  notebook: (id: string) => { location.hash = `#/nb/${id}`; },
  note: (id: string) => { location.hash = `#/note/${id}`; },
};

function showError(message: string) {
  const p = document.createElement('p');
  p.className = 'status';
  p.textContent = message;
  root.prepend(p);
}

let routing = Promise.resolve();
function route() {
  routing = routing.then(async () => {
    if (cleanup) { const c = cleanup; cleanup = null; await c(); }
    const [, kind, id] = location.hash.split('/');
    try {
      if (kind === 'nb' && id) {
        await openNotebookView(root, id, { openShelf: go.shelf, openNote: go.note });
      } else if (kind === 'note' && id) {
        cleanup = await openEditor(root, id, {
          onBack: async () => {
            const n = await getNote(id);
            const sec = n && await getSection(n.sectionId);
            if (sec) go.notebook(sec.notebookId); else go.shelf();
          },
          onImportPdf: async (file, note) => {
            try {
              const created = await importPdfNote(note.sectionId, file);
              go.note(created.id);
            } catch (e) { showError((e as Error).message); }
          },
        });
      } else {
        await openShelf(root, { openNotebook: go.notebook });
      }
    } catch (e) {
      console.error(e);
      root.replaceChildren();
      showError('開けませんでした。本棚に戻ります');
      setTimeout(go.shelf, 1500);
    }
  });
}

window.addEventListener('hashchange', route);
route();
void requestPersistentStorage();
