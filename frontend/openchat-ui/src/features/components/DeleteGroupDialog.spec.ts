import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import DeleteGroupDialog from './DeleteGroupDialog.svelte';

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

describe('DeleteGroupDialog', () => {
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

  function open(onConfirm: () => Promise<void>) {
    const onCancel = vi.fn();
    const confirm = vi.fn(onConfirm);
    app = mount(DeleteGroupDialog, { target, props: { groupName: 'Devs', onConfirm: confirm, onCancel } });
    const input = target.querySelector('input')!;
    input.value = 'devs';
    input.dispatchEvent(new Event('input'));
    flushSync();
    return { onCancel, confirm, deleteButton: target.querySelector('.delete'), layer: target.querySelector('.layer')! };
  }

  test('a second press while deleting is ignored', async () => {
    const d = deferred();
    const { confirm, deleteButton } = open(() => d.promise);
    press(deleteButton);
    press(deleteButton);
    await settle();
    expect(confirm).toHaveBeenCalledOnce();
  });

  test('Esc, the veil and Cancel do nothing while deleting', async () => {
    const d = deferred();
    const { onCancel, deleteButton, layer } = open(() => d.promise);
    press(deleteButton);
    await settle();
    esc();
    press(target.querySelector('.veil'));
    press(target.querySelector('.cancel'));
    await vi.runAllTimersAsync();
    expect(onCancel).not.toHaveBeenCalled();
    expect(layer.classList.contains('closing')).toBe(false);
  });

  test('success: leaves, calls onCancel once after the exit, and stays out', async () => {
    const d = deferred();
    const { onCancel, confirm, deleteButton, layer } = open(() => d.promise);
    press(deleteButton);
    d.resolve();
    await settle();
    expect(layer.classList.contains('closing')).toBe(true);
    expect(onCancel).not.toHaveBeenCalled();
    press(deleteButton); // nothing new during the exit
    esc();
    await vi.runAllTimersAsync();
    flushSync();
    expect(onCancel).toHaveBeenCalledOnce();
    expect(confirm).toHaveBeenCalledOnce();
    expect(layer.classList.contains('closing')).toBe(true);
  });

  test('failure keeps the dialog and the typed name, shows the error, and allows a retry', async () => {
    const { onCancel, confirm, deleteButton, layer } = open(() => Promise.reject(new Error('no')));
    press(deleteButton);
    await settle();
    expect(target.querySelector('[role=alert]')).not.toBeNull();
    expect(target.querySelector('input')!.value).toBe('devs');
    expect(layer.classList.contains('closing')).toBe(false);
    expect(onCancel).not.toHaveBeenCalled();
    press(deleteButton);
    await settle();
    expect(confirm).toHaveBeenCalledTimes(2);
  });
});
