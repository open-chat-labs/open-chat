import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { WalletToken } from '../../lib/types';
import WalletSwap, { type SwapQuote } from './WalletSwap.svelte';

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const deferred = <T = void>() => {
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
const tokens: WalletToken[] = [
  { symbol: 'ICP', name: 'Internet Computer', mark: '∞', grad: 'red', held: 10, price: 5, dp: 4, nets: ['icp'] },
  { symbol: 'USDT', name: 'Tether', mark: 'T', grad: 'green', held: 100, price: 1, dp: 2, nets: ['icp'] },
];

describe('WalletSwap', () => {
  let target: HTMLElement;
  let app: object | undefined;
  beforeEach(() => {
    vi.useFakeTimers();
    target = document.body.appendChild(document.createElement('div'));
  });
  afterEach(() => {
    if (app) unmount(app);
    app = undefined;
    target.remove();
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  const quote = (): SwapQuote => ({ dex: 'ICPSwap', dexFee: '0.3%', out: 4.9, impactPct: 0.1, networkFeeUsd: 0.01, expiresAt: Date.now() + 30_000 });
  const cta = () => target.querySelector('.side .cta') as HTMLElement;
  const title = () => target.querySelector('.page-header')!.textContent ?? '';

  /** Enters 1 ICP and gets a quote; returns the swap mock and onClose. */
  async function quoted(onSwap: () => Promise<{ out?: number } | void>) {
    const swap = vi.fn(onSwap);
    const onClose = vi.fn();
    app = mount(WalletSwap, { target, props: { tokens, token: 'ICP', onQuote: () => Promise.resolve(quote()), onSwap: swap, onClose } });
    flushSync();
    const input = target.querySelector<HTMLInputElement>('input.amount')!;
    input.value = '1';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    cta().click();
    await settle();
    return { swap, onClose };
  }

  test('a quote leads to the Swap button', async () => {
    await quoted(() => Promise.resolve());
    expect(target.querySelector('.quote-figures')).not.toBeNull();
  });

  test('two presses on Swap (even before the next render) start one swap', async () => {
    const d = deferred<{ out?: number } | void>();
    const { swap } = await quoted(() => d.promise);
    const button = cta();
    button.click();
    button.click();
    await settle();
    expect(swap).toHaveBeenCalledOnce();
  });

  test('the form is locked while swapping: flip, quick amounts and token picks do nothing', async () => {
    const d = deferred<{ out?: number } | void>();
    await quoted(() => d.promise);
    cta().click();
    await settle();
    const before = title();
    const form = target.querySelector<HTMLElement>('.form')!;
    expect(form.inert).toBe(true);
    (target.querySelector('.flip') as HTMLElement).click();
    flushSync();
    expect(title()).toBe(before);
    expect(target.querySelector<HTMLInputElement>('input.amount')!.value).toBe('1');
  });

  test('Back is ignored while the swap is in progress, and works again once it is done', async () => {
    const d = deferred<{ out?: number } | void>();
    const { onClose } = await quoted(() => d.promise);
    cta().click();
    await settle();
    const back = target.querySelector('.page-header .back [role=button]') as HTMLElement;
    back.click();
    expect(onClose).not.toHaveBeenCalled();
    d.resolve({ out: 4.9 });
    await settle();
    back.click();
    expect(onClose).toHaveBeenCalledOnce();
  });

  test('a rejected swap returns to the form with the amount kept and an error', async () => {
    await quoted(() => Promise.reject(new Error('slippage')));
    cta().click();
    await settle();
    expect(target.querySelector('.swap-error')).not.toBeNull();
    expect(target.querySelector<HTMLInputElement>('input.amount')!.value).toBe('1');
    expect(target.querySelector<HTMLElement>('.form')!.inert).toBe(false);
  });

  /** Mounts with ICP as the pay token and presses Max. */
  function max(icp: Partial<WalletToken>, extra: Record<string, unknown> = {}) {
    const list = [{ ...tokens[0], ...icp }, tokens[1]];
    app = mount(WalletSwap, { target, props: { tokens: list, token: 'ICP', onQuote: () => Promise.resolve(quote()), ...extra } });
    flushSync();
    const chips = target.querySelectorAll<HTMLElement>('.chips .chip');
    chips[3].click();
    flushSync();
    return target.querySelector<HTMLInputElement>('input.amount')!;
  }
  const over = () => cta().textContent!.includes('Not enough');

  test('Max keeps back the ledger fee, and the whole balance reads as too much', () => {
    const input = max({ held: 10, fee: 0.0001 });
    expect(input.value).toBe('9.9999');
    expect(over()).toBe(false);
    input.value = '10';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    expect(over()).toBe(true);
  });

  test('payFees keeps back that many fees', () => {
    expect(max({ held: 10, fee: 0.0001 }, { payFees: 2 }).value).toBe('9.9998');
  });

  test('Max is the whole balance to the last unit (no float rounding, no 6-decimal cap)', () => {
    expect(max({ held: 0.000251, dp: 6, fee: 0 }).value).toBe('0.000251');
    unmount(app!);
    app = undefined;
    expect(max({ held: 1.23456789, dp: 8, fee: 0 }).value).toBe('1.23456789');
  });

  test('the rate line shows the receiving token to its own decimals', async () => {
    // a receiving token worth far more than the pay token (any symbol, not only 'BTC')
    const dear: WalletToken = { ...tokens[1], price: 60000, dp: 8 };
    const swapQuote = { ...quote(), out: 0.0000833 };
    app = mount(WalletSwap, { target, props: { tokens: [tokens[0], dear], token: 'ICP', onQuote: () => Promise.resolve(swapQuote) } });
    flushSync();
    const input = target.querySelector<HTMLInputElement>('input.amount')!;
    input.value = '1';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    cta().click();
    await settle();
    expect(target.querySelector('.rate')!.textContent).toContain('0.0000833 USDT');
  });
});
