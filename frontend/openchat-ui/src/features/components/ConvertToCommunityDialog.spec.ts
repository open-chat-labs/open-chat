import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import ConvertToCommunityDialog from './ConvertToCommunityDialog.svelte';

const deferred = <T = unknown>() => {
  let resolve!: (v: T) => void, reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};
const settle = async () => {
  await vi.advanceTimersByTimeAsync(0);
  flushSync();
};
const press = (el: Element | null) => (el as HTMLElement).click();
const esc = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

describe('ConvertToCommunityDialog', () => {
  let target: HTMLElement;
  let app: object;
  beforeEach(() => {
    vi.useFakeTimers();
    target = document.body.appendChild(document.createElement('div'));
  });
  afterEach(() => {
    unmount(app);
    target.remove();
    vi.useRealTimers();
  });

  function open(props: Record<string, unknown>) {
    const onCancel = vi.fn();
    app = mount(ConvertToCommunityDialog, { target, props: { groupName: 'Devs', onCancel, ...props } });
    flushSync();
    return { onCancel, layer: target.querySelector('.layer')! };
  }
  const primary = () => target.querySelector('.primary');
  const isDone = () => !target.querySelector('.steps');

  test('converts once; the done step shows only after the host resolves', async () => {
    const d = deferred<{ communityId: string }>();
    const onConfirm = vi.fn(() => d.promise);
    open({ onConfirm });
    press(primary());
    press(primary());
    await settle();
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(isDone()).toBe(false);
    d.resolve({ communityId: 'c-9' });
    await settle();
    expect(isDone()).toBe(true);
  });

  test('nothing dismisses while converting', async () => {
    const d = deferred();
    const { onCancel, layer } = open({ onConfirm: () => d.promise });
    press(primary());
    await settle();
    esc();
    press(target.querySelector('.veil'));
    press(target.querySelector('.icon-button'));
    press(target.querySelector('.text-button'));
    await vi.runAllTimersAsync();
    expect(onCancel).not.toHaveBeenCalled();
    expect(layer.classList.contains('closing')).toBe(false);
  });

  test('cancel then Convert during the exit does not convert', async () => {
    const onConfirm = vi.fn(() => Promise.resolve());
    const { onCancel } = open({ onConfirm });
    press(target.querySelector('.text-button'));
    press(primary());
    await vi.runAllTimersAsync();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  test('failure stays on confirm with an error', async () => {
    const onConfirm = vi.fn(() => Promise.reject(new Error('x')));
    open({ onConfirm });
    press(primary());
    await settle();
    expect(isDone()).toBe(false);
    expect(target.querySelector('.error')).not.toBeNull();
  });

  test('"Go to the community" passes the id, leaves once and stays out', async () => {
    const onGoTo = vi.fn();
    const { layer } = open({ onConfirm: () => Promise.resolve({ communityId: 'c-9' }), onGoTo });
    press(primary());
    await settle();
    press(primary()); // Go to
    press(primary());
    await vi.runAllTimersAsync();
    flushSync();
    expect(onGoTo).toHaveBeenCalledOnce();
    expect(onGoTo).toHaveBeenCalledWith('c-9');
    expect(layer.classList.contains('closing')).toBe(true);
  });

  test('no Convert button without onConfirm', () => {
    open({});
    expect(primary()).toBeNull();
  });
});
