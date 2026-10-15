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
  const cta = () => target.querySelector('.form .cta') as HTMLElement;
  const title = () => target.querySelector('.page-header')!.textContent ?? '';
  function type(input: HTMLInputElement, text: string) {
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
  }

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

  test('a quote shows inline under the form and leads to the Swap button', async () => {
    await quoted(() => Promise.resolve());
    expect(target.querySelector('.form .quote')).not.toBeNull();
    expect(cta().textContent).toBe('Swap');
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

  test('while swapping the form is gone: the progress view shows what you pay and get', async () => {
    const d = deferred<{ out?: number } | void>();
    await quoted(() => d.promise);
    cta().click();
    await settle();
    expect(target.querySelector('.form')).toBeNull();
    const legs = [...target.querySelectorAll('.leg')].map((l) => l.textContent);
    expect(legs[0]).toContain('1 ICP');
    expect(legs[1]).toContain('4.9 USDT');
    expect(title()).toContain('Swap ICP');
  });

  test('the form is locked while a quote is being fetched', async () => {
    const q = deferred<SwapQuote>();
    const onQuote = vi.fn(() => q.promise);
    app = mount(WalletSwap, { target, props: { tokens, token: 'ICP', onQuote } });
    flushSync();
    type(target.querySelector<HTMLInputElement>('input.amount')!, '1');
    cta().click();
    flushSync();
    cta().click(); // a second press while fetching asks nothing more
    expect(onQuote).toHaveBeenCalledOnce();
    expect(target.querySelector<HTMLElement>('.form')!.inert).toBe(true);
    expect(cta().textContent).toContain('Getting quote');
    expect(cta().getAttribute('aria-busy')).toBe('true');
    q.resolve(quote());
    await settle();
    expect(target.querySelector<HTMLElement>('.form')!.inert).toBe(false);
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

  const blocked = () => cta().getAttribute('aria-disabled') === 'true';

  test('Max is the whole balance: the host takes the ledger fees out of the amount', () => {
    const input = max({ held: 10, fee: 0.0001 });
    expect(input.value).toBe('10');
    expect(over()).toBe(false);
    expect(blocked()).toBe(false);
    type(input, '10.0001');
    expect(over()).toBe(true);
  });

  test('an amount of 3 fees or less (approve + pull, then more than a fee left) is too small', () => {
    const input = max({ held: 10, fee: 0.0001 });
    type(input, '0.0003');
    expect(blocked()).toBe(true);
    expect(target.textContent).toContain('Must be more than 0.0003 ICP');
    type(input, '0.0004');
    expect(blocked()).toBe(false);
  });

  test('Max is the whole balance to the last unit (no float rounding, no 6-decimal cap)', () => {
    expect(max({ held: 0.000251, dp: 6, fee: 0 }).value).toBe('0.000251');
    unmount(app!);
    app = undefined;
    expect(max({ held: 1.23456789, dp: 8, fee: 0 }).value).toBe('1.23456789');
  });

  test('Max of a large 8-decimal balance or an 18-decimal balance is the balance, not "over"', () => {
    expect(max({ held: 19605831.33811045, dp: 8, fee: 0 }).value).toBe('19605831.33811045');
    expect(over()).toBe(false);
    unmount(app!);
    app = undefined;
    expect(max({ held: 0.044038500211371456, dp: 18, fee: 0 }).value).toBe('0.044038500211371456');
    expect(over()).toBe(false);
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

  test('a live quote can be refreshed; an expired one offers a new quote instead of Swap', async () => {
    const onQuote = vi.fn(() => Promise.resolve(quote()));
    app = mount(WalletSwap, { target, props: { tokens, token: 'ICP', onQuote, onSwap: () => Promise.resolve() } });
    flushSync();
    type(target.querySelector<HTMLInputElement>('input.amount')!, '1');
    cta().click();
    await settle();
    (target.querySelector('.quote [aria-label="Refresh quote"]') as HTMLElement).click();
    await settle();
    expect(onQuote).toHaveBeenCalledTimes(2);
    expect(cta().textContent).toBe('Swap');
    await vi.advanceTimersByTimeAsync(31_000);
    flushSync();
    expect(target.querySelector('.quote')!.textContent).toContain('Expired');
    // the countdown stops once it reaches 0
    expect(vi.getTimerCount()).toBe(0);
    expect(target.querySelector('.quote [aria-label="Refresh quote"]')).toBeNull();
    expect(cta().textContent).toContain('Get new quote');
    cta().click();
    await settle();
    expect(onQuote).toHaveBeenCalledTimes(3);
    expect(cta().textContent).toBe('Swap');
  });

  test('progress follows the three steps the host reports (approve, swap, withdraw), with where the money is', async () => {
    const d = deferred<{ out?: number } | void>();
    let step: (i: number) => void = () => {};
    await quoted((...args: unknown[]) => {
      step = (args[0] as { onStep: (i: number) => void }).onStep;
      return d.promise;
    });
    cta().click();
    await settle();
    const states = () => [...target.querySelectorAll('.timeline [role=listitem]')].map((r) => r.className.replace(/svelte-\S+/g, '').replace('step', '').trim());
    const funds = () => target.querySelector('.funds')!.textContent ?? '';
    expect(states()).toEqual(['active', 'todo', 'todo']);
    expect(funds()).toContain('1 ICP is still in your wallet');
    await vi.advanceTimersByTimeAsync(4000);
    step(1);
    flushSync();
    expect(states()).toEqual(['done', 'active', 'todo']);
    expect(target.querySelector('.timeline [role=listitem] .meta')!.textContent).toBe('0:04');
    expect(funds()).toContain('1 ICP is at ICPSwap, being swapped');
    step(9); // out of range: the last step
    flushSync();
    expect(states()).toEqual(['done', 'done', 'active']);
    expect(funds()).toContain('4.9 USDT on its way to your wallet');
    step(0); // a step never goes back
    flushSync();
    expect(states()).toEqual(['done', 'done', 'active']);
    expect(target.querySelector('.bar-text')!.textContent).toContain('Step 3 of 3');
    d.resolve({ out: 4.8 });
    await settle();
    expect(states()).toEqual(['done', 'done', 'done']);
    expect(target.querySelector('.kicker')!.textContent).toContain('SWAP COMPLETE');
    expect(funds()).toContain('4.8 USDT is in your wallet');
    expect(target.querySelector('.bar-text')!.textContent).toContain('Took');
  });

  test('when done: Swap again starts an empty form, Done reports the swap and leaves', async () => {
    const onSwapped = vi.fn();
    const onClose = vi.fn();
    app = mount(WalletSwap, { target, props: { tokens, token: 'ICP', onQuote: () => Promise.resolve(quote()), onSwap: () => Promise.resolve({ out: 4.8 }), onSwapped, onClose } });
    flushSync();
    type(target.querySelector<HTMLInputElement>('input.amount')!, '1');
    cta().click();
    await settle();
    cta().click();
    await settle();
    const again = target.querySelectorAll<HTMLElement>('.done-actions .cta')[0];
    expect(again.textContent).toBe('Swap again');
    again.click();
    flushSync();
    expect(target.querySelector<HTMLInputElement>('input.amount')!.value).toBe('');
    expect(target.querySelector('.form .quote')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    type(target.querySelector<HTMLInputElement>('input.amount')!, '2');
    cta().click();
    await settle();
    cta().click();
    await settle();
    target.querySelectorAll<HTMLElement>('.done-actions .cta')[1].click();
    expect(onSwapped).toHaveBeenCalledOnce();
    expect(onSwapped.mock.calls[0][0]).toMatchObject({ from: 'ICP', to: 'USDT', amount: 2, out: 4.8 });
    expect(onClose).toHaveBeenCalledOnce();
  });

  test('a failed quote shows an error and keeps the amount', async () => {
    app = mount(WalletSwap, { target, props: { tokens, token: 'ICP', onQuote: () => Promise.reject(new Error('down')) } });
    flushSync();
    type(target.querySelector<HTMLInputElement>('input.amount')!, '1');
    cta().click();
    await settle();
    expect(target.querySelector('.swap-error')!.textContent).toContain("Couldn't get a quote");
    expect(cta().textContent).toBe('Get quote');
    expect(target.querySelector<HTMLInputElement>('input.amount')!.value).toBe('1');
  });
});
