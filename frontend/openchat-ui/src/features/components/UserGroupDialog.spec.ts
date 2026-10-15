import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import UserGroupDialog from './UserGroupDialog.svelte';

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

const members = [
  { userId: 'u-a', name: 'Alice', handle: '@alice' },
  { userId: 'u-b', name: 'Bob', handle: '@bob' },
];
const group = { key: 'g-1', title: 'Developers', members };

describe('UserGroupDialog', () => {
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
    app = mount(UserGroupDialog, { target, props: { communityName: 'Devs', onCancel, ...props } });
    flushSync();
    return { onCancel, cta: target.querySelector('.cta'), layer: target.querySelector('.layer')! };
  }

  test('edit saves the group by key with member ids, once', async () => {
    const d = deferred();
    const onSave = vi.fn(() => d.promise);
    const { cta } = open({ dialogMode: 'edit', group, onSave });
    press(cta);
    press(cta);
    await settle();
    expect(onSave).toHaveBeenCalledOnce();
    expect((onSave.mock.calls[0] as unknown[])[0]).toEqual({ key: 'g-1', title: 'Developers', memberIds: ['u-a', 'u-b'] });
  });

  test('delete passes the key; nothing dismisses while it runs', async () => {
    const d = deferred();
    const onDelete = vi.fn(() => d.promise);
    const { onCancel, cta, layer } = open({ dialogMode: 'delete', group, onDelete });
    press(cta);
    await settle();
    esc();
    press(target.querySelector('.veil'));
    press(target.querySelector('[aria-label="Close"]')); // ×
    press(target.querySelector('.text-button'));
    await vi.runAllTimersAsync();
    expect(onDelete).toHaveBeenCalledWith('g-1');
    expect(onCancel).not.toHaveBeenCalled();
    expect(layer.classList.contains('closing')).toBe(false);
    d.resolve();
    await vi.runAllTimersAsync();
    expect(onCancel).toHaveBeenCalledOnce();
    expect(layer.classList.contains('closing')).toBe(true);
  });

  test('success blocks a second save during the exit', async () => {
    const onSave = vi.fn(() => Promise.resolve());
    const { onCancel, cta } = open({ dialogMode: 'edit', group, onSave });
    press(cta);
    await settle();
    press(cta);
    await vi.runAllTimersAsync();
    expect(onSave).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  test('failure keeps the form with an error and allows a retry', async () => {
    const onSave = vi.fn(() => Promise.reject(new Error('x')));
    const { onCancel, cta } = open({ dialogMode: 'edit', group, onSave });
    press(cta);
    await settle();
    expect(target.querySelector('.error')).not.toBeNull();
    expect((target.querySelector('input.box') as HTMLInputElement).value).toBe('Developers');
    expect(onCancel).not.toHaveBeenCalled();
    press(cta);
    await settle();
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  test('a taken name blocks saving; the group keeps its own name', async () => {
    const onSave = vi.fn(() => Promise.resolve());
    const { cta } = open({ dialogMode: 'edit', group, takenNames: ['Designers', 'Developers'], onSave });
    const input = target.querySelector('input.box') as HTMLInputElement;
    input.value = 'designers';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    press(cta);
    await settle();
    expect(onSave).not.toHaveBeenCalled();
    input.value = 'Developers';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    press(cta);
    await settle();
    expect(onSave).toHaveBeenCalledOnce();
  });
});
