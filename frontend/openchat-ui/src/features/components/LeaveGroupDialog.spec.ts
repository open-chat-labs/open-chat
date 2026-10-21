import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import LeaveGroupDialog from './LeaveGroupDialog.svelte';

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

describe('LeaveGroupDialog', () => {
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
    app = mount(LeaveGroupDialog, { target, props: { groupName: 'Devs', onConfirm: confirm, onCancel } });
    flushSync();
    return { onCancel, confirm, button: target.querySelector('.confirm'), layer: target.querySelector('.layer')! };
  }

  test('a second press while leaving is ignored', async () => {
    const d = deferred();
    const { confirm, button } = open(() => d.promise);
    press(button);
    press(button);
    await settle();
    expect(confirm).toHaveBeenCalledOnce();
  });

  test('Esc, the veil, × and Cancel do nothing while leaving', async () => {
    const d = deferred();
    const { onCancel, button, layer } = open(() => d.promise);
    press(button);
    await settle();
    esc();
    press(target.querySelector('.oc-veil'));
    press(target.querySelector('.close'));
    press(target.querySelector('.cancel'));
    await vi.runAllTimersAsync();
    expect(onCancel).not.toHaveBeenCalled();
    expect(layer.classList.contains('closing')).toBe(false);
  });

  test('success leaves, calls onCancel once and stays out', async () => {
    const d = deferred();
    const { onCancel, confirm, button, layer } = open(() => d.promise);
    press(button);
    d.resolve();
    await settle();
    expect(layer.classList.contains('closing')).toBe(true);
    press(button);
    esc();
    await vi.runAllTimersAsync();
    expect(onCancel).toHaveBeenCalledOnce();
    expect(confirm).toHaveBeenCalledOnce();
    expect(layer.classList.contains('closing')).toBe(true);
  });

  test('failure shows the error and allows a retry', async () => {
    const { onCancel, confirm, button, layer } = open(() => Promise.reject(new Error('sole owner')));
    press(button);
    await settle();
    expect(target.querySelector('[role=alert]')).not.toBeNull();
    expect(layer.classList.contains('closing')).toBe(false);
    expect(onCancel).not.toHaveBeenCalled();
    press(button);
    await settle();
    expect(confirm).toHaveBeenCalledTimes(2);
  });

  test('Cancel without a pending call leaves and calls back once', async () => {
    const { onCancel } = open(() => Promise.resolve());
    press(target.querySelector('.cancel'));
    press(target.querySelector('.cancel'));
    await vi.runAllTimersAsync();
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
