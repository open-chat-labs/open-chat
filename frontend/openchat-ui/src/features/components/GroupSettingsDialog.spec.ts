import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import GroupSettingsDialog from './GroupSettingsDialog.svelte';

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
const esc = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

describe('GroupSettingsDialog save', () => {
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

  function open(onSave: () => Promise<void>, props: Record<string, unknown> = {}) {
    const onCancel = vi.fn();
    const onDirtyChange = vi.fn();
    const save = vi.fn(onSave);
    app = mount(GroupSettingsDialog, { target, props: { value: { info: { name: 'Devs' } } as never, onSave: save, onCancel, onDirtyChange, ...props } });
    flushSync();
    const input = target.querySelector<HTMLInputElement>('.name-box input')!;
    input.value = 'Devs 2';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    const saveButton = () => target.querySelector<HTMLElement>('.save')!;
    return { onCancel, onDirtyChange, save, saveButton, root: target.querySelector('.root')! };
  }

  test('a gate missing its token or amount blocks Save and shows the Gates tab', async () => {
    const gates = { count: 1, joiner: 'All', rules: [{ id: 'r1', type: 'payment', asset: '', a: '', b: '' }], complete: false, intervalOn: false, every: '1 month' };
    const { save, saveButton } = open(() => Promise.resolve(), { value: { info: { name: 'Devs' }, gates } as never });
    saveButton().click();
    await settle();
    expect(save).not.toHaveBeenCalled();
    const selected = target.querySelector('[role=tab][aria-selected=true]');
    expect(selected?.textContent).toContain('Gates');
    expect(target.querySelector('.note.error')?.textContent).toContain('Finish the access gates');
  });

  test('modal: a second Save and every dismiss are ignored while saving; success leaves once', async () => {
    const d = deferred();
    const { onCancel, save, saveButton, root } = open(() => d.promise);
    saveButton().click();
    saveButton().click();
    esc();
    target.querySelector<HTMLElement>('.veil')!.click();
    target.querySelector<HTMLElement>('.cancel')!.click();
    await vi.advanceTimersByTimeAsync(500);
    expect(save).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
    d.resolve();
    await settle();
    expect(root.classList.contains('closing')).toBe(true);
    await vi.runAllTimersAsync();
    flushSync();
    expect(onCancel).toHaveBeenCalledOnce();
    expect(root.classList.contains('closing')).toBe(true);
  });

  test('modal: a failed save keeps the edits and the unsaved-changes guard, shows an error and can retry', async () => {
    const { onCancel, onDirtyChange, save, saveButton, root } = open(() => Promise.reject(new Error('no')));
    saveButton().click();
    await settle();
    expect(root.classList.contains('closing')).toBe(false);
    expect(target.querySelector('.note.error')).not.toBeNull();
    expect(target.querySelector<HTMLInputElement>('.name-box input')!.value).toBe('Devs 2');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    expect(saveButton().classList.contains('ready')).toBe(true);
    saveButton().click();
    await settle();
    expect(save).toHaveBeenCalledTimes(2);
    expect(onCancel).not.toHaveBeenCalled();
  });

  test('embedded: success re-baselines (clean again, Save disabled) and stays open', async () => {
    const { onCancel, onDirtyChange, saveButton, root } = open(() => Promise.resolve(), { embedded: true });
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    saveButton().click();
    await settle();
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    expect(saveButton().classList.contains('ready')).toBe(false);
    expect(root.classList.contains('closing')).toBe(false);
    await vi.runAllTimersAsync();
    expect(onCancel).not.toHaveBeenCalled();
  });
});
