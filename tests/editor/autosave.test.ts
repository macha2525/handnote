import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAutosave } from '../../src/editor/autosave';
import { StorageFullError } from '../../src/storage/db';
import type { Note } from '../../src/model/types';

const note = (title: string): Note => ({ id: 'n', sectionId: 's', title, background: 'plain', pages: [], updatedAt: 0 });

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
}

describe('autosave', () => {
  beforeEach(() => { vi.useFakeTimers(); setHidden(false); });
  afterEach(() => { vi.useRealTimers(); });

  it('saves once after the delay even with many edits', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const a = createAutosave(save);
    for (let i = 0; i < 10; i++) { a.schedule(note('v' + i)); await vi.advanceTimersByTimeAsync(100); }
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1500);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].title).toBe('v9');
  });

  it('flush saves immediately', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const a = createAutosave(save);
    a.schedule(note('x'));
    await a.flush();
    expect(save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('flush runs when the page becomes hidden', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const a = createAutosave(save);
    a.schedule(note('x'));
    setHidden(true);
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('reports StorageFullError and keeps the note', async () => {
    const save = vi.fn().mockRejectedValueOnce(new StorageFullError()).mockResolvedValue(undefined);
    const a = createAutosave(save);
    const errs: Error[] = [];
    a.onError(e => errs.push(e));
    a.schedule(note('keep'));
    await vi.advanceTimersByTimeAsync(1500);
    expect(errs[0]).toBeInstanceOf(StorageFullError);
    a.schedule(note('keep2'));
    await vi.advanceTimersByTimeAsync(1500);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0].title).toBe('keep2');
  });
});
