import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import StreakInsuranceDialog from './StreakInsuranceDialog.svelte';

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

describe('StreakInsuranceDialog', () => {
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

  function open(onBuy?: () => Promise<void>) {
    const onClose = vi.fn();
    const onBack = vi.fn();
    const buy = onBuy ? vi.fn(onBuy) : undefined;
    app = mount(StreakInsuranceDialog, { target, props: { streak: 5, balance: 1000, prices: [1, 2, 4, 12], onBuy: buy, onBack, onClose } });
    flushSync();
    return { onClose, onBack, buy, pay: target.querySelector('.pay'), layer: target.querySelector('.layer')! };
  }

  test('a second Pay while buying is ignored and the request carries the cover bought', async () => {
    const d = deferred();
    const { buy, pay } = open(() => d.promise);
    press(pay);
    press(pay);
    await settle();
    expect(buy).toHaveBeenCalledOnce();
    expect(buy).toHaveBeenCalledWith({ days: 1, cost: 1, fromPosition: 0 });
  });

  test('Esc, the veil, × and Back do nothing while buying', async () => {
    const d = deferred();
    const { onClose, onBack, pay, layer } = open(() => d.promise);
    press(pay);
    await settle();
    esc();
    press(target.querySelector('.oc-veil'));
    press(target.querySelector('.icon-button.close'));
    press(target.querySelector('.icon-button.back'));
    await vi.runAllTimersAsync();
    expect(onClose).not.toHaveBeenCalled();
    expect(onBack).not.toHaveBeenCalled();
    expect(layer.classList.contains('closing')).toBe(false);
  });

  test('success leaves and calls onClose once after the exit', async () => {
    const d = deferred();
    const { onClose, buy, pay, layer } = open(() => d.promise);
    press(pay);
    d.resolve();
    await settle();
    expect(layer.classList.contains('closing')).toBe(true);
    press(pay);
    await vi.runAllTimersAsync();
    expect(onClose).toHaveBeenCalledOnce();
    expect(buy).toHaveBeenCalledOnce();
  });

  test('failure stays open with the error and allows a retry', async () => {
    const { onClose, buy, pay } = open(() => Promise.reject(new Error('declined')));
    press(pay);
    await settle();
    expect(target.querySelector('[role=alert]')).not.toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    press(pay);
    await settle();
    expect(buy).toHaveBeenCalledTimes(2);
  });

  test('without onBuy Pay does nothing', async () => {
    const { onClose, pay } = open();
    expect(pay!.getAttribute('aria-disabled')).toBe('true');
    press(pay);
    await vi.runAllTimersAsync();
    expect(onClose).not.toHaveBeenCalled();
  });
});
