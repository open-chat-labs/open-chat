import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import CreateGroupDialog from './CreateGroupDialog.svelte';

const deferred = () => {
  let resolve!: () => void, reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
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

describe('CreateGroupDialog', () => {
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
    app = mount(CreateGroupDialog, { target, props: { onCancel, ...props } });
    flushSync();
    const input = target.querySelector('input:not([type=file])') as HTMLInputElement;
    input.value = 'My group';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    return { onCancel, root: target.querySelector('.root')! };
  }
  const create = () => target.querySelector('.create');

  test('creates once with the typed name; nothing dismisses while creating', async () => {
    const d = deferred();
    const onCreate = vi.fn(() => d.promise);
    const { onCancel, root } = open({ onCreate });
    press(create());
    press(create());
    await settle();
    esc();
    press(target.querySelector('.veil'));
    press(target.querySelector('[aria-label="Close"]')); // ×
    press(target.querySelector('.cancel'));
    await vi.runAllTimersAsync();
    expect(onCreate).toHaveBeenCalledOnce();
    expect((onCreate.mock.calls[0] as unknown[])[0]).toMatchObject({ name: 'My group', kind: 'group' });
    expect(onCancel).not.toHaveBeenCalled();
    expect(root.classList.contains('closing')).toBe(false);
  });

  test('success leaves once, stays out, and Enter/click during the exit creates nothing more', async () => {
    const onCreate = vi.fn(() => Promise.resolve());
    const { onCancel, root } = open({ onCreate });
    press(create());
    await settle();
    expect(root.classList.contains('closing')).toBe(true);
    press(create());
    esc();
    await vi.runAllTimersAsync();
    flushSync();
    expect(onCreate).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
    expect(root.classList.contains('closing')).toBe(true);
  });

  test('failure keeps the whole form and shows an error; a retry works', async () => {
    const onCreate = vi.fn(() => Promise.reject(new Error('taken')));
    const { onCancel, root } = open({ onCreate });
    press(create());
    await settle();
    expect(target.querySelector('.note.error')).not.toBeNull();
    expect((target.querySelector('input:not([type=file])') as HTMLInputElement).value).toBe('My group');
    expect(root.classList.contains('closing')).toBe(false);
    expect(onCancel).not.toHaveBeenCalled();
    press(create());
    await settle();
    expect(onCreate).toHaveBeenCalledTimes(2);
  });

  test('cancel then create during the exit does not create', async () => {
    const onCreate = vi.fn(() => Promise.resolve());
    const { onCancel } = open({ onCreate });
    press(target.querySelector('.cancel'));
    press(create());
    await vi.runAllTimersAsync();
    expect(onCreate).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
