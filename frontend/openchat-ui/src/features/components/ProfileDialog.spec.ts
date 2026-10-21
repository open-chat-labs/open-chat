import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import ProfileDialog from './ProfileDialog.svelte';

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
const base = { handle: 'ana', userId: 'u-ana', memberSince: 'Sep 2021', streak: 4, balance: 1000, name: 'Ana' };

describe('ProfileDialog', () => {
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
    const onClose = vi.fn();
    app = mount(ProfileDialog, { target, props: { ...base, onClose, ...props } });
    flushSync();
    return { onClose, layer: target.querySelector('.layer')! };
  }
  const press = (el: Element | null | undefined) => {
    (el as HTMLElement).click();
    flushSync();
  };
  const tryEveryClose = () => {
    press(target.querySelector('.oc-veil'));
    press(target.querySelector('.head-close'));
    esc();
    flushSync();
  };

  test('nothing closes the dialog while a profile field is saving', async () => {
    const d = deferred();
    const onSave = vi.fn(() => d.promise);
    const { onClose, layer } = open({ onSave });
    press(target.querySelector('.kv-row.editable'));
    const input = target.querySelector<HTMLInputElement>('.editor input')!;
    input.value = 'Ana B';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    press(target.querySelector('.editor .save'));
    expect(onSave).toHaveBeenCalledOnce();
    tryEveryClose();
    await vi.runAllTimersAsync();
    expect(onClose).not.toHaveBeenCalled();
    expect(layer.classList.contains('closing')).toBe(false);
    d.resolve();
    await settle();
    press(target.querySelector('.head-close'));
    await vi.runAllTimersAsync();
    expect(onClose).toHaveBeenCalledOnce();
  });

  test('nothing closes the dialog while logging out; success leaves once', async () => {
    const d = deferred();
    const onLogout = vi.fn(() => d.promise);
    const { onClose, layer } = open({ onLogout });
    press([...target.querySelectorAll('.rail-foot .nav-item')].at(-1));
    press(target.querySelector('.lo-confirm'));
    press(target.querySelector('.lo-confirm'));
    expect(onLogout).toHaveBeenCalledOnce();
    press(target.querySelector('.sub-veil'));
    press(target.querySelector('.lo-cancel'));
    tryEveryClose();
    await vi.runAllTimersAsync();
    expect(onClose).not.toHaveBeenCalled();
    expect(target.querySelector('.lo-confirm')).not.toBeNull(); // the sheet stays up
    d.resolve();
    await settle();
    await vi.runAllTimersAsync();
    expect(onClose).toHaveBeenCalledOnce();
    expect(layer.classList.contains('closing')).toBe(true);
  });

  test('a rejected community name falls back to the host value with an error', async () => {
    const onCommunityName = vi.fn(() => Promise.reject(new Error('x')));
    open({ section: 'communities', communities: [{ id: 'c1', name: 'OpenChat' }], communityNames: { c1: 'Ana (OC)' }, onCommunityName });
    const shown = () => target.querySelector('.community-shown')!.textContent;
    expect(shown()).toBe('Ana (OC)');
    press(target.querySelector('.community'));
    const input = target.querySelector<HTMLInputElement>('.editor input')!;
    input.value = 'Anna';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    press(target.querySelector('.editor .save'));
    expect(onCommunityName).toHaveBeenCalledWith('c1', 'Anna');
    expect(shown()).toBe('Anna');
    await settle();
    expect(shown()).toBe('Ana (OC)');
    expect(target.querySelector('[role=alert]')).not.toBeNull();
  });

  test('the latest community name wins over an older rejection', async () => {
    const calls: ReturnType<typeof deferred>[] = [];
    const onCommunityName = vi.fn(() => {
      const d = deferred();
      calls.push(d);
      return d.promise;
    });
    open({ section: 'communities', communities: [{ id: 'c1', name: 'OpenChat' }], communityNames: {}, onCommunityName });
    const rename = (to: string) => {
      press(target.querySelector('.community'));
      const input = target.querySelector<HTMLInputElement>('.editor input')!;
      input.value = to;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      flushSync();
      press(target.querySelector('.editor .save'));
    };
    rename('First');
    rename('Second');
    calls[1].resolve();
    calls[0].reject(new Error('late'));
    await settle();
    expect(target.querySelector('.community-shown')!.textContent).toBe('Second');
    expect(target.querySelector('[role=alert]')).toBeNull();
  });
});
