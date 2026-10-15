import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { toUnits } from '../../lib/amount';
import type { WalletToken } from '../../lib/types';
import WalletSend, { type SendContact, type WalletSendRequest } from './WalletSend.svelte';

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
const esc = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
const icp: WalletToken = { symbol: 'ICP', name: 'Internet Computer', mark: '∞', grad: 'red', held: 10, price: 5, dp: 4, fee: 0.0001, nets: ['icp'] };
const ADDRESS = '5sj6i-pqaaa-aaaaf-a3cmq-cai';
const JANE: SendContact = { userId: 'u-jane', name: 'Jane Doe', handle: '@common_jane' };

// jsdom has no ResizeObserver (bind:clientWidth); the wide layout is used
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

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

const cta = () => target.querySelector('.summary .cta') as HTMLElement;
const pinDialog = () => document.querySelector<HTMLFormElement>('form.pin');
function typeAmount(text: string) {
  const input = target.querySelector<HTMLInputElement>('.amount-input')!;
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
  return input;
}
function typePin(pin: string) {
  const input = document.querySelector<HTMLInputElement>('.pin-input')!;
  input.value = pin;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
}
const submit = (form: HTMLFormElement | null = pinDialog()) => form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
const headerBack = () => (target.querySelector('.page-header .back [role=button]') as HTMLElement).click();
const status = () => target.querySelector('.status')?.textContent ?? '';
const button = (text: string) => [...target.querySelectorAll<HTMLElement>('.done-button')].find((b) => b.textContent === text);
const chips = () => target.querySelectorAll<HTMLElement>('.chips .chip');

/** Mounts Send, fills the form (address prefilled, 1 ICP unless `amount`) and opens the PIN dialog. */
function openPinStep(onSent: (r: WalletSendRequest) => Promise<unknown> | void, props: Record<string, unknown> = {}) {
  const sent = vi.fn(onSent);
  const onClose = vi.fn();
  app = mount(WalletSend, { target, props: { tokens: [icp], token: 'ICP', address: ADDRESS, onSent: sent, onClose, ...props } });
  flushSync();
  typeAmount('1');
  cta().click();
  flushSync();
  return { sent, onClose };
}

describe('WalletSend PIN step', () => {
  test('opens the PIN dialog for a valid send', () => {
    openPinStep(() => undefined);
    expect(pinDialog()).not.toBeNull();
    expect(cta().textContent).toBe('Send 1 ICP to 5sj6i-pqaa…mq-cai');
  });

  test('a send can only run once while it is pending', async () => {
    const d = deferred();
    const { sent } = openPinStep(() => d.promise);
    typePin('123456');
    const form = pinDialog();
    submit(form);
    submit(form);
    await settle();
    expect(sent).toHaveBeenCalledOnce();
    expect(sent.mock.calls[0][0]).toMatchObject({ symbol: 'ICP', amount: 1, to: ADDRESS, network: 'icp', pin: '123456' });
  });

  test('while sending the receipt shows "Sending"; Esc and Back neither leave nor bring the PIN dialog back', async () => {
    const d = deferred();
    const { sent, onClose } = openPinStep(() => d.promise);
    typePin('123456');
    submit();
    await settle();
    expect(pinDialog()).toBeNull();
    expect(target.querySelector('.tag')!.textContent).toBe('SENDING');
    expect(status()).toContain('Sending 1 ICP to 5sj6i-pqaa…mq-cai');
    esc();
    headerBack();
    await settle();
    expect(onClose).not.toHaveBeenCalled();
    expect(pinDialog()).toBeNull();
    expect(target.querySelector('.amount-input')).toBeNull(); // nothing to resubmit
    expect(sent).toHaveBeenCalledOnce();
    d.resolve();
    await settle();
    expect(target.querySelector('.tag')!.textContent).toBe('SENT');
  });

  test('a wrong PIN reopens the dialog with an error, clears the PIN and allows a retry', async () => {
    let attempt = 0;
    const { sent } = openPinStep(() => (++attempt === 1 ? Promise.reject(new Error('wrong PIN')) : Promise.resolve()));
    typePin('111111');
    submit();
    await settle();
    expect(pinDialog()).not.toBeNull();
    expect(target.querySelector('.status')).toBeNull();
    expect(document.querySelector('.pin-error')).not.toBeNull();
    expect(document.querySelector<HTMLInputElement>('.pin-input')!.value).toBe('');
    typePin('123456');
    expect(document.querySelector('.pin-error')).toBeNull();
    submit();
    await settle();
    expect(sent).toHaveBeenCalledTimes(2);
    expect(pinDialog()).toBeNull();
    expect(status()).toContain('Sent 1 ICP');
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
    expect(target.querySelector('.amount-input')).not.toBeNull();
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

describe('WalletSend receipt', () => {
  async function sendTo(props: Record<string, unknown>, result: unknown = { id: '18402117' }) {
    const onDone = vi.fn();
    const onClose = vi.fn();
    app = mount(WalletSend, { target, props: { tokens: [icp], token: 'ICP', onSent: () => Promise.resolve(result), onDone, onClose, ...props } });
    flushSync();
    if (!props.address) {
      (target.querySelector('.quick-person') as HTMLElement).click();
      flushSync();
    }
    typeAmount('2');
    cta().click();
    flushSync();
    typePin('123456');
    submit();
    await settle();
    return { onDone, onClose };
  }

  test('once the host resolves: Sent, the transaction it returned, and Done hands back once through onDone', async () => {
    const { onDone, onClose } = await sendTo({ address: ADDRESS });
    expect(target.querySelector('.tag')!.textContent).toBe('SENT');
    expect(status()).toContain('Sent 2 ICP');
    expect(target.querySelector('.rc-rows')!.textContent).toContain('#18402117');
    expect(button('View in chat')).toBeUndefined(); // an address has no chat
    button('Done')!.click();
    button('Done')!.click();
    expect(onDone).toHaveBeenCalledOnce();
    expect(onDone.mock.calls[0][0]).toMatchObject({ request: { amount: 2, to: ADDRESS }, result: { id: '18402117' }, openChat: false });
    expect(onClose).not.toHaveBeenCalled();
  });

  test('no transaction row without an id from the host', async () => {
    await sendTo({ address: ADDRESS }, null);
    expect(target.querySelector('.rc-rows')!.textContent).not.toContain('Transaction');
  });

  test('Back on the receipt is Done', async () => {
    const { onDone } = await sendTo({ address: ADDRESS });
    headerBack();
    expect(onDone).toHaveBeenCalledOnce();
    expect(onDone.mock.calls[0][0].openChat).toBe(false);
  });

  test('to a person: "{name} received", and View in chat hands back with openChat', async () => {
    const { onDone } = await sendTo({ contacts: [JANE] });
    expect(status()).toContain('Jane received 2 ICP');
    button('View in chat')!.click();
    expect(onDone).toHaveBeenCalledOnce();
    expect(onDone.mock.calls[0][0]).toMatchObject({ request: { userId: 'u-jane', person: true }, openChat: true });
  });

  test('without onDone, Done closes', async () => {
    const { onClose } = await sendTo({ address: ADDRESS, onDone: undefined });
    button('Done')!.click();
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('WalletSend quick amounts', () => {
  /** Opens the PIN dialog from the current form and submits 123456. */
  function confirm() {
    cta().click();
    flushSync();
    typePin('123456');
    submit();
  }

  test('Max in USD sends the whole balance, though the USD figure is rounded down to cents', () => {
    // $3.337 a token: the whole balance reads $3.33 (rounded up, $3.34 would be more than the balance)
    const tk: WalletToken = { symbol: 'ICP', name: 'Internet Computer', mark: '∞', grad: 'red', held: 1, price: 3.337, dp: 8, fee: 0, nets: ['icp'] };
    const sent = vi.fn();
    app = mount(WalletSend, { target, props: { tokens: [tk], token: 'ICP', address: ADDRESS, onSent: sent } });
    flushSync();
    (target.querySelector('.unit') as HTMLElement).click();
    flushSync();
    chips()[chips().length - 1].click();
    flushSync();
    expect(target.querySelector<HTMLInputElement>('.amount-input')!.value).toBe('3.33');
    expect(cta().getAttribute('aria-disabled')).toBe('false');
    confirm();
    expect(sent.mock.calls[0][0]).toMatchObject({ amount: 1 });
  });

  test('Max of an 18-decimal balance is the balance less the fee, and can be sent', () => {
    const eth: WalletToken = { symbol: 'ckETH', name: 'ckETH', mark: 'E', grad: 'blue', held: 0.044038500211371456, price: 2500, dp: 18, fee: 0.000002, nets: ['icp'] };
    const sent = vi.fn();
    app = mount(WalletSend, { target, props: { tokens: [eth], token: 'ckETH', address: ADDRESS, onSent: sent } });
    flushSync();
    chips()[chips().length - 1].click();
    flushSync();
    // the whole balance less the fee, to the last unit a number can hold
    expect(target.querySelector<HTMLInputElement>('.amount-input')!.value).toMatch(/^0\.04403650021137145\d$/);
    expect(cta().getAttribute('aria-disabled')).toBe('false');
    confirm();
    const { amount } = sent.mock.calls[0][0];
    expect(toUnits(amount, 18) + toUnits(eth.fee!, 18) <= toUnits(eth.held, 18)).toBe(true);
    expect(amount).toBeGreaterThan(0.0440365002113714);
  });

  test('typing over a picked amount sends what was typed', () => {
    const tk: WalletToken = { symbol: 'ICP', name: 'Internet Computer', mark: '∞', grad: 'red', held: 1, price: 3.337, dp: 8, fee: 0, nets: ['icp'] };
    app = mount(WalletSend, { target, props: { tokens: [tk], token: 'ICP', address: ADDRESS, onSent: vi.fn() } });
    flushSync();
    (target.querySelector('.unit') as HTMLElement).click();
    flushSync();
    chips()[chips().length - 1].click();
    flushSync();
    typeAmount('3.34');
    // $3.34 is more than the 1 token held
    expect(cta().getAttribute('aria-disabled')).toBe('true');
  });

  describe('inputDp', () => {
    const eth: WalletToken = { symbol: 'ckETH', name: 'ckETH', mark: 'E', grad: 'blue', held: 0.044038500211371456, price: 2500, dp: 18, inputDp: 8, fee: 0.000002, nets: ['icp'] };

    test('typed amounts keep at most inputDp decimals', () => {
      app = mount(WalletSend, { target, props: { tokens: [eth], token: 'ckETH', address: ADDRESS, onSent: vi.fn() } });
      flushSync();
      expect(typeAmount('0,0123456789123').value).toBe('0,01234567');
    });

    test('Max is the balance less the fee, rounded down to inputDp, and that is what is sent', () => {
      const sent = vi.fn();
      app = mount(WalletSend, { target, props: { tokens: [eth], token: 'ckETH', address: ADDRESS, onSent: sent } });
      flushSync();
      chips()[chips().length - 1].click();
      flushSync();
      expect(target.querySelector<HTMLInputElement>('.amount-input')!.value).toBe('0.0440365');
      confirm();
      expect(sent.mock.calls[0][0].amount).toBe(0.0440365);
    });

    test('a USD amount converts to at most inputDp decimals', () => {
      const sent = vi.fn();
      const cheap = { ...eth, held: 10, price: 3 };
      app = mount(WalletSend, { target, props: { tokens: [cheap], token: 'ckETH', address: ADDRESS, onSent: sent } });
      flushSync();
      (target.querySelector('.unit') as HTMLElement).click();
      flushSync();
      typeAmount('1'); // $1 is a third of a token
      confirm();
      expect(sent.mock.calls[0][0].amount).toBe(0.33333333);
    });
  });
});
