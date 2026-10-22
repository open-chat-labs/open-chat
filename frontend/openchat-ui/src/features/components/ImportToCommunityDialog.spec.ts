import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import ImportToCommunityDialog from './ImportToCommunityDialog.svelte';

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

const communities = [
  { id: 'c-1', name: 'Alpha', members: 10, channels: 2 },
  { id: 'c-2', name: 'Beta', members: 20, channels: 3 },
];

describe('ImportToCommunityDialog', () => {
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

  function open(onConfirm: (c: unknown) => Promise<void>) {
    const onCancel = vi.fn();
    const confirm = vi.fn(onConfirm);
    app = mount(ImportToCommunityDialog, { target, props: { groupName: 'Devs', communities, onConfirm: confirm, onCancel } });
    flushSync();
    press(target.querySelectorAll('.community')[1]);
    flushSync();
    return { onCancel, confirm, primary: target.querySelector('.primary'), layer: target.querySelector('.layer')! };
  }

  test('imports the picked community by id, once', async () => {
    const d = deferred();
    const { confirm, primary } = open(() => d.promise);
    press(primary);
    press(primary);
    await settle();
    expect(confirm).toHaveBeenCalledOnce();
    expect((confirm.mock.calls[0] as unknown[])[0]).toMatchObject({ id: 'c-2' });
  });

  test('nothing dismisses or goes back while importing', async () => {
    const d = deferred();
    const { onCancel, primary, layer } = open(() => d.promise);
    press(primary);
    await settle();
    esc();
    press(target.querySelector('.oc-veil'));
    press(target.querySelector('.text-button'));
    press(target.querySelector('.icon-button')); // back
    await vi.runAllTimersAsync();
    expect(onCancel).not.toHaveBeenCalled();
    expect(layer.classList.contains('closing')).toBe(false);
    expect(target.querySelector('.primary')).not.toBeNull();
  });

  test('success leaves once; Enter during the exit does not import again', async () => {
    const { onCancel, confirm, primary, layer } = open(() => Promise.resolve());
    press(primary);
    await settle();
    expect(layer.classList.contains('closing')).toBe(true);
    press(primary);
    await vi.runAllTimersAsync();
    expect(confirm).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  test('cancel then confirm during the exit does not import', async () => {
    const { onCancel, confirm, primary } = open(() => Promise.resolve());
    press(target.querySelector('.text-button'));
    press(primary);
    await vi.runAllTimersAsync();
    expect(confirm).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  test('failure stays on confirm with an error and allows a retry', async () => {
    const { onCancel, confirm, primary } = open(() => Promise.reject(new Error('x')));
    press(primary);
    await settle();
    expect(target.querySelector('.error')).not.toBeNull();
    expect(onCancel).not.toHaveBeenCalled();
    press(primary);
    await settle();
    expect(confirm).toHaveBeenCalledTimes(2);
  });
});
