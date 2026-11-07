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
    const pending = toasts.showPending('Ann is blocked');
    const id = toasts.current!.id;
    pending.done(undo);
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
    replaced.done(undo)();
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
});
