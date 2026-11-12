import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ToastLayer } from './toasts.svelte';

let layer: ToastLayer;

beforeEach(() => {
  vi.useFakeTimers();
  layer = new ToastLayer();
});
afterEach(() => {
  layer.dispose();
  vi.useRealTimers();
});

describe('ToastLayer', () => {
  test('shows a toast as given, and it goes after its duration', () => {
    layer.show({
      message: 'Sent 12.5 ICP to @lucy',
      detail: 'Confirmed in 2s',
      tone: 'success',
      size: 'lg',
      icon: 'check',
      duration: 6000,
    });
    expect(layer.current).toMatchObject({
      message: 'Sent 12.5 ICP to @lucy',
      detail: 'Confirmed in 2s',
      tone: 'success',
      size: 'lg',
      icon: 'check',
    });
    vi.advanceTimersByTime(5999);
    expect(layer.current).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(layer.current).toBeNull();
  });

  test('without a duration it stays until it is taken down', () => {
    const takeDown = layer.show({ message: 'ICP hidden' });
    vi.advanceTimersByTime(60_000);
    expect(layer.current).not.toBeNull();
    takeDown();
    expect(layer.current).toBeNull();
  });

  test('a new toast takes the old one’s place, with a new id and its own time', () => {
    const takeDownFirst = layer.show({ message: 'First', duration: 4000 });
    const first = layer.current!.id;
    vi.advanceTimersByTime(3000);
    layer.show({ message: 'Second', duration: 4000 });
    expect(layer.current).toMatchObject({ message: 'Second' });
    expect(layer.current!.id).not.toBe(first);
    // the first one's time and its take-down no longer reach the second
    vi.advanceTimersByTime(1500);
    takeDownFirst();
    expect(layer.current).toMatchObject({ message: 'Second' });
    vi.advanceTimersByTime(2500);
    expect(layer.current).toBeNull();
  });

  test('the action takes the toast down, then runs once', () => {
    const onAction = vi.fn(() => expect(layer.current).toBeNull());
    const onClose = vi.fn();
    layer.show({ message: 'Sent', onAction, onClose, duration: 6000 });
    layer.action();
    layer.action();
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  test('the × takes the toast down and tells its owner, once', () => {
    const onAction = vi.fn();
    const onClose = vi.fn();
    layer.show({ message: 'ICP hidden', onAction, onClose });
    layer.close();
    layer.close();
    expect(layer.current).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onAction).not.toHaveBeenCalled();
  });

  test('going by itself or being replaced runs neither callback', () => {
    const onAction = vi.fn();
    const onClose = vi.fn();
    layer.show({ message: 'First', onAction, onClose, duration: 1000 });
    vi.advanceTimersByTime(1000);
    layer.show({ message: 'Second', onAction, onClose });
    layer.show({ message: 'Third' });
    expect(onAction).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  test('a pending toast stays, busy, until it settles, then says how it went in the same slot, for its own time', () => {
    const pending = layer.showPending({ message: 'Unfreezing Book Club…', icon: 'none' });
    const id = layer.current!.id;
    expect(layer.current).toMatchObject({ message: 'Unfreezing Book Club…', busy: true });
    vi.advanceTimersByTime(60_000);
    expect(layer.current).not.toBeNull();
    pending.settle({
      message: 'Book Club unfrozen',
      tone: 'success',
      icon: 'check',
      duration: 2500,
    });
    // the same id: it changes in place rather than playing in again
    expect(layer.current).toMatchObject({ id, message: 'Book Club unfrozen', tone: 'success' });
    expect(layer.current!.busy).toBeUndefined();
    vi.advanceTimersByTime(2499);
    expect(layer.current).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(layer.current).toBeNull();
  });

  test('a pending toast has no action or × while it waits', () => {
    const onAction = vi.fn();
    const pending = layer.showPending({ message: 'Unfreezing…' });
    layer.action();
    layer.close();
    expect(layer.current).toMatchObject({ busy: true });
    pending.settle({ message: "Couldn't unfreeze Book Club", onAction });
    layer.action();
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(layer.current).toBeNull();
  });

  test('a pending toast another has replaced settles to nothing, and its take-down leaves the other alone', () => {
    const pending = layer.showPending({ message: 'Unfreezing…' });
    layer.show({ message: 'Sent', duration: 4000 });
    const takeDown = pending.settle({ message: 'Unfrozen', duration: 1000 });
    expect(layer.current).toMatchObject({ message: 'Sent' });
    takeDown();
    vi.advanceTimersByTime(1000);
    expect(layer.current).toMatchObject({ message: 'Sent' });
  });

  test('a pending toast replaces the one showing and stops its timer', () => {
    layer.show({ message: 'Frozen', duration: 1000 });
    layer.showPending({ message: 'Unfreezing…' });
    vi.advanceTimersByTime(5000);
    expect(layer.current).toMatchObject({ message: 'Unfreezing…', busy: true });
  });
});
