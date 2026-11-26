import type { Note } from '../model/types';

export interface Autosave {
  schedule(n: Note): void;
  flush(): Promise<void>;
  onError(cb: (e: Error) => void): void;
  /** 保存に成功したとき（エラー表示を消すのに使う） */
  onSaved(cb: () => void): void;
  dispose(): void;
}

/** 書くたびに schedule し、最後の変更から delayMs 後に1回だけ保存する。 */
export function createAutosave(save: (n: Note) => Promise<void>, opts?: { delayMs?: number }): Autosave {
  const delay = opts?.delayMs ?? 1500;
  let pending: Note | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running: Promise<void> = Promise.resolve();
  const errorCbs: ((e: Error) => void)[] = [];
  const savedCbs: (() => void)[] = [];

  const run = (): Promise<void> => {
    if (timer) { clearTimeout(timer); timer = null; }
    running = running.then(async () => {
      const n = pending;
      if (!n) return;
      pending = null;
      try {
        await save(n);
        savedCbs.forEach(cb => cb());
      } catch (e) {
        // 書いた内容は失わない：次の schedule / flush で再試行する
        if (!pending) pending = n;
        errorCbs.forEach(cb => cb(e instanceof Error ? e : new Error(String(e))));
      }
    });
    return running;
  };

  const onHide = () => { if (document.visibilityState === 'hidden') void run(); };
  const onPageHide = () => { void run(); };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', onPageHide);

  return {
    schedule(n) {
      pending = n;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void run(); }, delay);
    },
    flush: run,
    onError(cb) { errorCbs.push(cb); },
    onSaved(cb) { savedCbs.push(cb); },
    dispose() {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
      if (timer) clearTimeout(timer);
    },
  };
}
