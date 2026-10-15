import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { WalletToken } from '../../lib/types';
import WalletSend, { type WalletSendRequest } from './WalletSend.svelte';

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
const icp: WalletToken = { symbol: 'ICP', name: 'Internet Computer', mark: '∞', grad: 'red', held: 10, price: 5, dp: 4, fee: 0.0001, nets: ['icp'] };
const ADDRESS = '5sj6i-pqaaa-aaaaf-a3cmq-cai';

// jsdom has no ResizeObserver (bind:clientWidth); the wide layout is used
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

describe('WalletSend PIN step', () => {
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

  /** Fills the form (address prefilled, 1 ICP) and opens the PIN dialog. */
  function openPinStep(onSent: (r: WalletSendRequest) => Promise<unknown> | void) {
    const sent = vi.fn(onSent);
    const onClose = vi.fn();
    app = mount(WalletSend, { target, props: { tokens: [icp], token: 'ICP', address: ADDRESS, onSent: sent, onClose } });
    flushSync();
    const amount = target.querySelector<HTMLInputElement>('.amount-input')!;
    amount.value = '1';
    amount.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    (target.querySelector('.summary-cell .cta') as HTMLElement).click();
    flushSync();
    return { sent, onClose };
  }
  const pinDialog = () => document.querySelector('form.pin');
  function typePin(pin: string) {
    const input = document.querySelector<HTMLInputElement>('.pin-input')!;
    input.value = pin;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
  }
  const submit = () => pinDialog()!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  const headerBack = () => (target.querySelector('.page-header .back [role=button]') as HTMLElement).click();

  test('opens the PIN dialog for a valid send', () => {
    openPinStep(() => undefined);
    expect(pinDialog()).not.toBeNull();
  });

  test('a send can only run once while it is pending', async () => {
    const d = deferred();
    const { sent } = openPinStep(() => d.promise);
    typePin('123456');
    submit();
    submit();
    await settle();
    expect(sent).toHaveBeenCalledOnce();
    expect(sent.mock.calls[0][0]).toMatchObject({ symbol: 'ICP', amount: 1, to: ADDRESS, network: 'icp', pin: '123456' });
  });

  test('Esc and Back can neither close nor reopen the PIN dialog while sending', async () => {
    const d = deferred();
    const { sent, onClose } = openPinStep(() => d.promise);
    typePin('123456');
    submit();
    await settle();
    esc();
    headerBack();
    await settle();
    expect(pinDialog()).not.toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    submit();
    await settle();
    expect(sent).toHaveBeenCalledOnce();
    d.resolve();
    await settle();
    expect(pinDialog()).toBeNull();
  });

  test('a wrong PIN keeps the dialog open with an error, clears the PIN and allows a retry', async () => {
    let attempt = 0;
    const { sent } = openPinStep(() => (++attempt === 1 ? Promise.reject(new Error('wrong PIN')) : Promise.resolve()));
    typePin('111111');
    submit();
    await settle();
    expect(pinDialog()).not.toBeNull();
    expect(document.querySelector('.pin-error')).not.toBeNull();
    expect(document.querySelector<HTMLInputElement>('.pin-input')!.value).toBe('');
    typePin('123456');
    expect(document.querySelector('.pin-error')).toBeNull();
    submit();
    await settle();
    expect(sent).toHaveBeenCalledTimes(2);
    expect(pinDialog()).toBeNull();
  });

  test('after a failure the dialog can be closed again', async () => {
    const { onClose } = openPinStep(() => Promise.reject(new Error('no')));
    typePin('123456');
    submit();
    await settle();
    headerBack();
    await settle();
    expect(pinDialog()).toBeNull();
    expect(onClose).not.toHaveBeenCalled(); // Back from the PIN step returns to the form, not out of Send
  });

  test('the chosen token stays chosen when its balance drops to 0 (never silently another token)', async () => {
    const usdt: WalletToken = { symbol: 'USDT', name: 'Tether', mark: 'T', grad: 'green', held: 100, price: 1, dp: 2, nets: ['eth', 'icp'] };
    const { reactiveProps } = await import('../../lib/testing/reactiveProps.svelte');
    const props = reactiveProps<Record<string, unknown>>({ tokens: [icp, usdt], token: 'ICP', address: ADDRESS, onSent: () => new Promise(() => {}) });
    app = mount(WalletSend, { target, props: props as never });
    flushSync();
    props.tokens = [{ ...icp, held: 0 }, usdt];
    flushSync();
    expect(target.querySelector('.page-header')!.textContent).toContain('ICP');
    expect(target.querySelector('.page-header')!.textContent).not.toContain('USDT');
  });
});

describe('WalletSend quick amounts', () => {
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

  test('Max in USD sends the whole balance, though the USD figure is rounded down to cents', () => {
    // $3.337 a token: the whole balance reads $3.33 (rounded up, $3.34 would be more than the balance)
    const tk: WalletToken = { symbol: 'ICP', name: 'Internet Computer', mark: '∞', grad: 'red', held: 1, price: 3.337, dp: 8, fee: 0, nets: ['icp'] };
    const sent = vi.fn();
    app = mount(WalletSend, { target, props: { tokens: [tk], token: 'ICP', address: ADDRESS, onSent: sent } });
    flushSync();
    (target.querySelector('.unit') as HTMLElement).click();
    flushSync();
    const chips = target.querySelectorAll<HTMLElement>('.chips .chip');
    chips[chips.length - 1].click();
    flushSync();
    expect(target.querySelector<HTMLInputElement>('.amount-input')!.value).toBe('3.33');
    const cta = target.querySelector('.summary-cell .cta')!;
    expect(cta.getAttribute('aria-disabled')).toBe('false');
    (cta as HTMLElement).click();
    flushSync();
    const pin = document.querySelector<HTMLInputElement>('.pin-input')!;
    pin.value = '123456';
    pin.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    document.querySelector('form.pin')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(sent.mock.calls[0][0]).toMatchObject({ amount: 1 });
  });

  test('typing over a picked amount sends what was typed', () => {
    const tk: WalletToken = { symbol: 'ICP', name: 'Internet Computer', mark: '∞', grad: 'red', held: 1, price: 3.337, dp: 8, fee: 0, nets: ['icp'] };
    app = mount(WalletSend, { target, props: { tokens: [tk], token: 'ICP', address: ADDRESS, onSent: vi.fn() } });
    flushSync();
    (target.querySelector('.unit') as HTMLElement).click();
    flushSync();
    const chips = target.querySelectorAll<HTMLElement>('.chips .chip');
    chips[chips.length - 1].click();
    flushSync();
    const input = target.querySelector<HTMLInputElement>('.amount-input')!;
    input.value = '3.34';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    // $3.34 is more than the 1 token held
    expect(target.querySelector('.summary-cell .cta')!.getAttribute('aria-disabled')).toBe('true');
  });
});
