import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import UserDialog from './UserDialog.svelte';

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
const facts = [{ label: 'Member since', value: 'Sep 2021' }];

describe('UserDialog', () => {
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
    app = mount(UserDialog, { target, props: { title: 'Ana Ferreira', facts, onCancel, ...props } });
    flushSync();
    return { onCancel, layer: target.querySelector('.layer')! };
  }
  const startBlock = () => {
    target.querySelector<HTMLElement>('.footer .block')!.click();
    flushSync();
    target.querySelector<HTMLElement>('.footer.confirm .block')!.click();
    flushSync();
  };

  describe('block', () => {
    test('nothing dismisses it while pending; on success it leaves once and stays out', async () => {
      const d = deferred();
      const onBlock = vi.fn(() => d.promise);
      const { onCancel, layer } = open({ onBlock });
      startBlock();
      esc();
      target.querySelector<HTMLElement>('.veil')!.click();
      target.querySelector<HTMLElement>('.footer.confirm .block')!.click(); // a second press
      await vi.advanceTimersByTimeAsync(500);
      expect(onCancel).not.toHaveBeenCalled();
      expect(onBlock).toHaveBeenCalledOnce();
      d.resolve();
      await settle();
      expect(layer.classList.contains('closing')).toBe(true);
      esc();
      await vi.runAllTimersAsync();
      flushSync();
      expect(onCancel).toHaveBeenCalledOnce();
      expect(layer.classList.contains('closing')).toBe(true);
    });

    test('a successful unblock keeps the dialog open', async () => {
      const onUnblock = vi.fn(() => Promise.resolve());
      const { onCancel, layer } = open({ blocked: true, onUnblock });
      startBlock();
      await vi.runAllTimersAsync();
      flushSync();
      expect(onUnblock).toHaveBeenCalledOnce();
      expect(onCancel).not.toHaveBeenCalled();
      expect(layer.classList.contains('closing')).toBe(false);
    });

    test('a rejection keeps the dialog with an error and allows a retry', async () => {
      const onBlock = vi.fn(() => Promise.reject(new Error('no')));
      const { onCancel, layer } = open({ onBlock });
      startBlock();
      await settle();
      expect(layer.classList.contains('closing')).toBe(false);
      // the error replaces the prompt (and is announced), so assert on the error itself
      const error = target.querySelector('.footer.confirm [role=alert]');
      expect(error?.textContent).toMatch(/couldn.t block/i);
      expect(error?.textContent).not.toMatch(/won.t be able/i);
      target.querySelector<HTMLElement>('.footer.confirm .block')!.click();
      await settle();
      expect(onBlock).toHaveBeenCalledTimes(2);
      expect(onCancel).not.toHaveBeenCalled();
    });

    test('no Block without onBlock', () => {
      open({});
      expect(target.querySelector('.footer .block')).toBeNull();
    });
  });

  describe('favourite', () => {
    const favPill = () => target.querySelector<HTMLElement>('.pill.fav')!;
    const isFav = () => favPill().getAttribute('aria-pressed') === 'true';

    test('latest wins, and two rejections end on the host value with an error', async () => {
      const calls: ReturnType<typeof deferred>[] = [];
      open({
        dmTabs: true,
        fav: false,
        onToggleFavourite: () => {
          const d = deferred();
          calls.push(d);
          return d.promise;
        },
      });
      favPill().click();
      flushSync();
      favPill().click();
      flushSync();
      expect(isFav()).toBe(false);
      calls[0].reject(new Error('x'));
      calls[1].reject(new Error('y'));
      await settle();
      expect(isFav()).toBe(false);
      expect(target.querySelector('.error[role=alert]')).not.toBeNull();
    });

    test('an older rejection after a newer accepted change is ignored', async () => {
      const calls: ReturnType<typeof deferred>[] = [];
      open({
        dmTabs: true,
        fav: false,
        onToggleFavourite: () => {
          const d = deferred();
          calls.push(d);
          return d.promise;
        },
      });
      favPill().click(); // on
      flushSync();
      favPill().click(); // off
      flushSync();
      favPill().click(); // on
      flushSync();
      calls[2].resolve();
      await settle();
      calls[0].reject(new Error('late'));
      calls[1].reject(new Error('late'));
      await settle();
      expect(isFav()).toBe(true);
      expect(target.querySelector('.error[role=alert]')).toBeNull();
    });
  });
});
