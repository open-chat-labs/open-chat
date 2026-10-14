import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { WalletToken } from '../../lib/types';
import WalletMain, { type WalletRequest } from './WalletMain.svelte';
import { reactiveProps } from '../../lib/testing/reactiveProps.svelte';

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const deferred = () => {
  let resolve!: (v?: unknown) => void, reject!: (e: unknown) => void;
  const promise = new Promise<unknown>((res, rej) => {
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
  { symbol: 'ICP', name: 'Internet Computer', mark: '∞', grad: 'red', held: 10, price: 5, dp: 4, fee: 0.0001, nets: ['icp'] },
  { symbol: 'USDT', name: 'Tether', mark: 'T', grad: 'green', held: 100, price: 1, dp: 2, nets: ['eth', 'icp'] },
];

describe('WalletMain', () => {
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

  function setup(extra: Record<string, unknown> = {}) {
    const onViewChange = vi.fn();
    const props = reactiveProps<Record<string, unknown>>({ tokens, request: null as WalletRequest | null, onViewChange, ...extra });
    app = mount(WalletMain, { target, props: props as never });
    flushSync();
    return { props, onViewChange };
  }
  const go = (props: Record<string, unknown>, r: Omit<WalletRequest, 'nonce'>, nonce: number) => {
    props.request = { ...r, nonce };
    flushSync();
  };

  /** Opens Send for ICP to an address and submits the PIN. */
  async function sendPending(props: Record<string, unknown>) {
    go(props, { view: 'send', token: 'ICP' }, 1);
    (target.querySelectorAll<HTMLElement>('.mode')[1]).click();
    flushSync();
    const address = target.querySelector<HTMLInputElement>('.address-input')!;
    address.value = '5sj6i-pqaaa-aaaaf-a3cmq-cai';
    address.dispatchEvent(new Event('input', { bubbles: true }));
    const amount = target.querySelector<HTMLInputElement>('.amount-input')!;
    amount.value = '1';
    amount.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    (target.querySelector('.summary-cell .cta') as HTMLElement).click();
    flushSync();
    const pin = document.querySelector<HTMLInputElement>('.pin-input')!;
    pin.value = '123456';
    pin.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    document.querySelector('form.pin')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await settle();
  }

  test('a host request while a send is pending keeps the send (and its PIN dialog) on screen', async () => {
    const d = deferred();
    const onSent = vi.fn(() => d.promise);
    const { props, onViewChange } = setup({ onSent });
    await sendPending(props);
    expect(onSent).toHaveBeenCalledOnce();
    onViewChange.mockClear();
    go(props, { view: 'token', token: 'USDT' }, 2);
    await settle();
    expect(document.querySelector('form.pin')).not.toBeNull();
    // the host is told the view didn't change
    expect(onViewChange).toHaveBeenLastCalledWith({ view: 'send', token: 'ICP' });
    d.resolve();
    await settle();
    // the send completes as usual: back on the ICP token page with a toast
    expect(document.querySelector('form.pin')).toBeNull();
    expect(onViewChange).toHaveBeenLastCalledWith({ view: 'token', token: 'ICP' });
  });

  test('requests apply normally once nothing is pending (a token request switches the open flow to it)', async () => {
    const { props, onViewChange } = setup({ onSent: () => Promise.resolve() });
    go(props, { view: 'send', token: 'ICP' }, 1);
    go(props, { view: 'token', token: 'USDT' }, 2);
    expect(onViewChange).toHaveBeenLastCalledWith({ view: 'send', token: 'USDT' });
    go(props, { view: 'all' }, 3);
    expect(onViewChange).toHaveBeenLastCalledWith({ view: 'all', token: null });
  });

  test('Receive offers a receivable token on its own networks', () => {
    const { props } = setup({
      receivable: [{ symbol: 'USDC', name: 'USD Coin', mark: '$', grad: 'blue', nets: ['eth', 'icp'] }],
      addresses: { icp: '5sj6i-pqaaa-aaaaf-a3cmq-cai', eth: '0x7Bf3c9A1e64D25aB8f0C3e7d19A4b62F5dE81Ca0' },
    });
    go(props, { view: 'receive', token: 'USDC' }, 1);
    expect(target.querySelector('.page-header')!.textContent).toContain('USDC');
  });
});
