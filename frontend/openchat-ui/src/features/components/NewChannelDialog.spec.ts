import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import NewChannelDialog from './NewChannelDialog.svelte';

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

describe('NewChannelDialog', () => {
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

  function open(props: Record<string, unknown> = {}) {
    const onCancel = vi.fn();
    app = mount(NewChannelDialog, { target, props: { communityName: 'Devs', onCancel, ...props } });
    flushSync();
    const input = target.querySelector('input')!;
    input.value = 'Release Notes';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    return { onCancel, cta: target.querySelector('.cta'), layer: target.querySelector('.layer')! };
  }

  test('the slugged name reaches the host once, even when pressed twice', async () => {
    const d = deferred();
    const onCreate = vi.fn(() => d.promise);
    const { cta } = open({ onCreate });
    press(cta);
    press(cta);
    await settle();
    expect(onCreate).toHaveBeenCalledOnce();
    expect((onCreate.mock.calls[0] as unknown[])[0]).toMatchObject({ name: 'release-notes', isPublic: false, embedded: false });
  });

  test('nothing dismisses while creating', async () => {
    const d = deferred();
    const { onCancel, cta, layer } = open({ onCreate: () => d.promise });
    press(cta);
    await settle();
    esc();
    press(target.querySelector('.veil'));
    press(target.querySelector('.close'));
    press(target.querySelector('.cancel'));
    await vi.runAllTimersAsync();
    expect(onCancel).not.toHaveBeenCalled();
    expect(layer.classList.contains('closing')).toBe(false);
  });

  test('success leaves once and blocks a second create during the exit', async () => {
    const onCreate = vi.fn(() => Promise.resolve());
    const { onCancel, cta, layer } = open({ onCreate });
    press(cta);
    await settle();
    expect(layer.classList.contains('closing')).toBe(true);
    press(cta);
    await vi.runAllTimersAsync();
    expect(onCreate).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  test('cancel then create during the exit does not create', async () => {
    const onCreate = vi.fn(() => Promise.resolve());
    const { onCancel, cta } = open({ onCreate });
    press(target.querySelector('.cancel'));
    press(cta);
    await vi.runAllTimersAsync();
    expect(onCreate).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  test('failure keeps the form and shows the error', async () => {
    const onCreate = vi.fn(() => Promise.reject(new Error('taken')));
    const { onCancel, cta, layer } = open({ onCreate });
    press(cta);
    await settle();
    expect(target.querySelector('.error')).not.toBeNull();
    expect(target.querySelector('input')!.value).toBe('release-notes');
    expect(layer.classList.contains('closing')).toBe(false);
    expect(onCancel).not.toHaveBeenCalled();
  });

  test('a taken name blocks create', async () => {
    const onCreate = vi.fn(() => Promise.resolve());
    const { cta } = open({ onCreate, checkName: () => Promise.resolve('taken') });
    await vi.advanceTimersByTimeAsync(500);
    flushSync();
    press(cta);
    await settle();
    expect(onCreate).not.toHaveBeenCalled();
  });
});
