import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ToastQueue } from './toastQueue.svelte';

let toasts: ToastQueue;

beforeEach(() => {
  vi.useFakeTimers();
  toasts = new ToastQueue();
});
afterEach(() => {
  toasts.dispose();
  vi.useRealTimers();
});

describe('ToastQueue', () => {
  test('shows a toast, and it goes after 2.6s', () => {
    toasts.show('Marked as read');
    expect(toasts.current).toMatchObject({ message: 'Marked as read', undoable: false });
    vi.advanceTimersByTime(2599);
    expect(toasts.current).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(toasts.current).toBeNull();
  });

  test('one with Undo stays 5s', () => {
    toasts.show('You left OpenChat Labs', () => {});
    expect(toasts.current?.undoable).toBe(true);
    vi.advanceTimersByTime(4999);
    expect(toasts.current).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(toasts.current).toBeNull();
  });

  test('a new toast takes the old one’s place, with a new id and its own time', () => {
    toasts.show('First');
    const first = toasts.current!.id;
    vi.advanceTimersByTime(2000);
    toasts.show('Second');
    expect(toasts.current).toMatchObject({ message: 'Second' });
    expect(toasts.current!.id).not.toBe(first);
    vi.advanceTimersByTime(2000);
    expect(toasts.current?.message).toBe('Second');
    vi.advanceTimersByTime(600);
    expect(toasts.current).toBeNull();
  });

  test('Undo runs the undo once and dismisses the toast', () => {
    const undo = vi.fn();
    toasts.show('Chat archived', undo);
    toasts.undo();
    toasts.undo();
    expect(undo).toHaveBeenCalledTimes(1);
    expect(toasts.current).toBeNull();
  });

  test("a replaced toast's undo is gone: Undo only undoes what's showing", () => {
    const first = vi.fn();
    toasts.show('Chat archived', first);
    toasts.show('Marked as read');
    toasts.undo();
    expect(first).not.toHaveBeenCalled();
  });

  test('dismissing never runs the undo, and stops the timer', () => {
    const undo = vi.fn();
    toasts.show('Chat deleted', undo);
    toasts.dismiss();
    expect(toasts.current).toBeNull();
    vi.advanceTimersByTime(10_000);
    expect(undo).not.toHaveBeenCalled();
  });

  test("a toast's own dismiss takes it down, and leaves one that has taken its place", () => {
    const undo = vi.fn();
    const dismissFirst = toasts.show('Chat deleted', undo);
    dismissFirst();
    expect(toasts.current).toBeNull();
    toasts.undo();
    expect(undo).not.toHaveBeenCalled();

    const dismissSecond = toasts.show('You left OpenChat Labs', () => {});
    toasts.show('Pinned');
    dismissSecond();
    expect(toasts.current?.message).toBe('Pinned');
  });

  test('a pending toast shows at once with no buttons, and stays until its action is done', () => {
    const pending = toasts.showPending('Blocking Ann');
    expect(toasts.current).toMatchObject({ message: 'Blocking Ann', pending: true, undoable: false });
    vi.advanceTimersByTime(60_000);
    expect(toasts.current?.pending).toBe(true);
    toasts.undo();
    expect(toasts.current).not.toBeNull();
  });

  test('done, it offers Undo in place of the loader and goes after 5s; Undo undoes', () => {
    const undo = vi.fn();
    const pending = toasts.showPending('Blocking Ann…');
    const id = toasts.current!.id;
    pending.done({ undo });
    expect(toasts.current).toMatchObject({ id, pending: false, undoable: true });
    vi.advanceTimersByTime(4999);
    expect(toasts.current).not.toBeNull();
    toasts.undo();
    expect(undo).toHaveBeenCalledTimes(1);
    expect(toasts.current).toBeNull();
  });

  test('done without an undo, it goes after 2.6s', () => {
    toasts.showPending('Saving').done();
    expect(toasts.current).toMatchObject({ pending: false, undoable: false });
    vi.advanceTimersByTime(2600);
    expect(toasts.current).toBeNull();
  });

  test('failed, it goes; and settling leaves a toast that has taken its place alone', () => {
    toasts.showPending('Blocking Ann').failed();
    expect(toasts.current).toBeNull();

    const replaced = toasts.showPending('Blocking Ann');
    toasts.show('Muted');
    const undo = vi.fn();
    replaced.done({ undo })();
    replaced.failed();
    expect(toasts.current).toMatchObject({ message: 'Muted', pending: false });
    toasts.undo();
    expect(undo).not.toHaveBeenCalled();
  });

  test('a pending toast takes the place of one offering Undo, whose undo is gone', () => {
    const undo = vi.fn();
    toasts.show('Chat deleted', undo);
    toasts.showPending('Blocking Ann').done();
    toasts.undo();
    expect(undo).not.toHaveBeenCalled();
  });

  test('done, it says how it went, in place, with a full time counted from then', () => {
    const pending = toasts.showPending('Blocking Ann…');
    const id = toasts.current!.id;
    vi.advanceTimersByTime(4000);
    pending.done({ message: 'Blocked Ann', undo: () => {} });
    expect(toasts.current).toMatchObject({ id, message: 'Blocked Ann', pending: false, undoable: true });
    vi.advanceTimersByTime(4999);
    expect(toasts.current).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(toasts.current).toBeNull();
  });

  describe('an Undo that runs an operation of its own', () => {
    // the operation's promise settling, without moving the clock (vi.waitFor would)
    async function settled() {
      for (let i = 0; i < 5; i++) await Promise.resolve();
    }

    function deferred() {
      let resolve!: (value: string | undefined) => void;
      const promise = new Promise<string | undefined>((r) => (resolve = r));
      return { promise, resolve };
    }

    test('keeps the toast, waiting with no timeout, then shows the result for a full time', async () => {
      const unblock = deferred();
      const run = vi.fn(() => unblock.promise);
      toasts.show('Blocked Ann', { pending: 'Unblocking Ann…', run });
      const id = toasts.current!.id;
      vi.advanceTimersByTime(4900);
      toasts.undo();
      expect(run).toHaveBeenCalledTimes(1);
      expect(toasts.current).toMatchObject({ id, message: 'Unblocking Ann…', pending: true, undoable: false });
      // a toast waiting on its operation never times out, and can't be undone again
      vi.advanceTimersByTime(30_000);
      toasts.undo();
      expect(run).toHaveBeenCalledTimes(1);
      expect(toasts.current?.pending).toBe(true);
      unblock.resolve('Unblocked Ann');
      await settled();
      expect(toasts.current?.message).toBe('Unblocked Ann');
      expect(toasts.current).toMatchObject({ id, pending: false, undoable: false });
      vi.advanceTimersByTime(2599);
      expect(toasts.current).not.toBeNull();
      vi.advanceTimersByTime(1);
      expect(toasts.current).toBeNull();
    });

    test('goes when the operation fails (the host says why), or throws', async () => {
      toasts.show('Blocked Ann', { pending: 'Unblocking Ann…', run: async () => undefined });
      toasts.undo();
      await settled();
      expect(toasts.current).toBeNull();

      toasts.show('Blocked Ann', { pending: 'Unblocking Ann…', run: () => Promise.reject(new Error('down')) });
      toasts.undo();
      await settled();
      expect(toasts.current).toBeNull();
    });

    test("leaves a toast that has taken its place alone when it's done", async () => {
      const unblock = deferred();
      toasts.show('Blocked Ann', { pending: 'Unblocking Ann…', run: () => unblock.promise });
      toasts.undo();
      toasts.show('Muted');
      unblock.resolve('Unblocked Ann');
      await settled();
      expect(toasts.current?.message).toBe('Muted');
    });
  });
});
