import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { WalletToken } from '../../lib/types';
import WalletMain, { type WalletRequest } from './WalletMain.svelte';
import type { WalletSendRequest } from './WalletSend.svelte';
import { reactiveProps } from '../../lib/testing/reactiveProps.svelte';

// The flows are stand-ins that record the props WalletMain hands them: these specs are about WalletMain's routing,
// pinning and landing, not the flows' own screens (each flow has its own spec).
const flows = vi.hoisted(() => {
  const make = (name: string) => {
    const rec = { mounts: 0, props: null as Record<string, unknown> | null };
    const component = (anchor: Comment, props: Record<string, unknown>) => {
      rec.mounts++;
      rec.props = props;
      void anchor;
      void name;
    };
    return { rec, component };
  };
  return { send: make('send'), swap: make('swap'), receive: make('receive') };
});
vi.mock('./WalletSend.svelte', () => ({ default: flows.send.component }));
vi.mock('./WalletSwap.svelte', () => ({ default: flows.swap.component }));
vi.mock('./WalletReceive.svelte', () => ({ default: flows.receive.component }));

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
  { symbol: 'ICP', name: 'Internet Computer', mark: '∞', grad: 'red', held: 10, price: 5, dp: 4, fee: 0.0001, nets: ['icp'], ledger: 'ryjl3-tyaaa-aaaaa-aaaba-cai', standard: 'ICRC-1' },
  { symbol: 'USDT', name: 'Tether', mark: 'T', grad: 'green', held: 100, price: 1, dp: 2, nets: ['eth', 'icp'] },
];
const request = (extra: Partial<WalletSendRequest> = {}): WalletSendRequest => ({
  symbol: 'ICP',
  amount: 1,
  fee: 0.0001,
  fiat: 5,
  to: '5sj6i-pqaaa-aaaaf-a3cmq-cai',
  toLabel: '5sj6i-pqaa…cmq-cai',
  network: 'icp',
  pin: '123456',
  dp: 4,
  person: false,
  ...extra,
});

describe('WalletMain', () => {
  let target: HTMLElement;
  let app: object | undefined;
  beforeEach(() => {
    vi.useFakeTimers();
    target = document.body.appendChild(document.createElement('div'));
    for (const f of Object.values(flows)) {
      f.rec.mounts = 0;
      f.rec.props = null;
    }
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
  const send = () => flows.send.rec.props as unknown as {
    token: string;
    onSent: (r: WalletSendRequest) => Promise<unknown>;
    onDone: (v: { request: WalletSendRequest; result: unknown; openChat: boolean }) => void;
  };
  const header = () => target.querySelector('.page-header')?.textContent ?? '';

  test('a host request while a send is pending keeps the send mounted; it stays on its receipt once the host confirms', async () => {
    const d = deferred();
    const { props, onViewChange } = setup({ onSent: vi.fn(() => d.promise) });
    go(props, { view: 'send', token: 'ICP' }, 1);
    const sending = send().onSent(request());
    onViewChange.mockClear();
    go(props, { view: 'token', token: 'USDT' }, 2);
    await settle();
    expect(flows.send.rec.mounts).toBe(1);
    // the host is told the view didn't change
    expect(onViewChange).toHaveBeenLastCalledWith({ view: 'send', token: 'ICP' });
    d.resolve({ id: 'tx1' });
    await expect(sending).resolves.toEqual({ id: 'tx1' });
    await settle();
    // Send shows its own receipt: no landing or toast until it is left
    expect(onViewChange).toHaveBeenLastCalledWith({ view: 'send', token: 'ICP' });
    expect(target.querySelector('.toast')).toBeNull();
  });

  test('a rejected send propagates back to Send (its PIN dialog shows the error)', async () => {
    const { props } = setup({ onSent: () => Promise.reject(new Error('wrong PIN')) });
    go(props, { view: 'send', token: 'ICP' }, 1);
    await expect(send().onSent(request())).rejects.toThrow('wrong PIN');
  });

  test('a token request leaves an idle flow for that token page', () => {
    const { props, onViewChange } = setup({ onSent: () => Promise.resolve() });
    go(props, { view: 'send', token: 'ICP' }, 1);
    go(props, { view: 'token', token: 'USDT' }, 2);
    expect(onViewChange).toHaveBeenLastCalledWith({ view: 'token', token: 'USDT' });
    expect(header()).toContain('Tether');
    go(props, { view: 'all' }, 3);
    expect(onViewChange).toHaveBeenLastCalledWith({ view: 'all', token: null });
  });

  test('a token request while a swap is waiting on the host keeps the swap', async () => {
    const d = deferred();
    const { props, onViewChange } = setup({ onSwap: vi.fn(() => d.promise) });
    go(props, { view: 'swap', token: 'ICP' }, 1);
    const onSwap = flows.swap.rec.props!.onSwap as (r: unknown) => Promise<unknown>;
    const swapping = onSwap({});
    go(props, { view: 'token', token: 'USDT' }, 2);
    expect(onViewChange).toHaveBeenLastCalledWith({ view: 'swap', token: 'ICP' });
    expect(flows.swap.rec.mounts).toBe(1);
    d.resolve();
    await swapping;
    await settle();
    // once it's done, requests apply again
    go(props, { view: 'token', token: 'USDT' }, 3);
    expect(onViewChange).toHaveBeenLastCalledWith({ view: 'token', token: 'USDT' });
  });

  test('leaving the receipt lands on the token page with a toast and a pending row until the host lists it', async () => {
    const { props, onViewChange } = setup({ onSent: () => Promise.resolve({ id: 'tx1' }) });
    go(props, { view: 'send', token: 'ICP' }, 1);
    const result = await send().onSent(request());
    send().onDone({ request: request(), result, openChat: false });
    await settle();
    expect(onViewChange).toHaveBeenLastCalledWith({ view: 'token', token: 'ICP' });
    expect(target.querySelector('.toast')!.textContent).toContain('1.0000 ICP');
    expect(target.textContent).toContain('Pending');
    // the host's activity now lists it: its row replaces the local one
    props.activity = [{ id: 'tx1', symbol: 'ICP', kind: 'send', title: 'Sent to 5sj6i', timestamp: Date.now(), amount: 1, fiat: 5, status: 'sent' }];
    await settle();
    expect(target.textContent).not.toContain('Pending');
    expect(target.textContent).toContain('Sent to 5sj6i');
  });

  test('a confirmed send shows its pending row even when the receipt is left another way', async () => {
    const { props } = setup({ onSent: () => Promise.resolve({ id: 'tx1' }) });
    go(props, { view: 'send', token: 'ICP' }, 1);
    await send().onSent(request());
    go(props, { view: 'token', token: 'ICP' }, 2);
    await settle();
    expect(target.textContent).toContain('Pending');
    expect(target.querySelector('.toast')).toBeNull();
  });

  test('"View in chat" opens the DM instead of the toast', async () => {
    const onMessage = vi.fn();
    const { props, onViewChange } = setup({ onSent: () => Promise.resolve(), onMessage });
    go(props, { view: 'send', token: 'ICP' }, 1);
    const r = request({ userId: 'u-jane', toLabel: 'Jane Doe', person: true, to: 'u-jane', network: 'openchat' });
    await send().onSent(r);
    send().onDone({ request: r, result: undefined, openChat: true });
    await settle();
    expect(onMessage).toHaveBeenCalledWith({ userId: 'u-jane', text: expect.stringContaining('Jane Doe') });
    expect(target.querySelector('.toast')).toBeNull();
    expect(onViewChange).toHaveBeenLastCalledWith({ view: 'token', token: 'ICP' });
  });

  test('a send to a person from All activity lands back on All with a "Message" toast', async () => {
    const onMessage = vi.fn();
    const { props, onViewChange } = setup({ onSent: () => Promise.resolve(), onMessage });
    go(props, { view: 'send', fromAll: true, token: 'ICP' }, 1);
    const r = request({ userId: 'u-jane', toLabel: 'Jane Doe', person: true });
    await send().onSent(r);
    send().onDone({ request: r, result: undefined, openChat: false });
    await settle();
    expect(onViewChange).toHaveBeenLastCalledWith({ view: 'all', token: null });
    const toast = target.querySelector('.toast')!;
    expect(toast.textContent).toContain('Message');
    (toast.querySelector('[role=button]') as HTMLElement).click();
    expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u-jane' }));
  });

  test('sending the whole balance: the pending send stays mounted when the host reports a 0 balance', async () => {
    const d = deferred();
    const { props, onViewChange } = setup({ onSent: vi.fn(() => d.promise) });
    go(props, { view: 'send', token: 'ICP' }, 1);
    const sending = send().onSent(request({ amount: 9.9999 }));
    // the host reflects the outgoing transfer before it confirms: ICP is now 0 (and drops out of the held rows)
    props.tokens = [{ ...tokens[0], held: 0 }, tokens[1]];
    await settle();
    expect(flows.send.rec.mounts).toBe(1);
    expect(send().token).toBe('ICP');
    d.resolve();
    await sending;
    send().onDone({ request: request({ amount: 9.9999 }), result: undefined, openChat: false });
    await settle();
    expect(target.querySelector('.toast')!.textContent).toContain('ICP');
    expect(onViewChange).toHaveBeenLastCalledWith({ view: 'token', token: 'ICP' });
  });

  test('after a whole-balance send, the token page shows and acts on the token that is left', async () => {
    const { props } = setup({ onSent: () => Promise.resolve() });
    go(props, { view: 'send', token: 'ICP' }, 1);
    await send().onSent(request());
    props.tokens = [{ ...tokens[0], held: 0 }, tokens[1]];
    send().onDone({ request: request(), result: undefined, openChat: false });
    await settle();
    // the token page now shows Tether (ICP has no balance left)
    const actions = target.querySelectorAll<HTMLElement>('.actions .action');
    expect(actions[1].textContent).toContain('USDT');
    actions[1].click(); // Receive USDT
    flushSync();
    expect(flows.receive.rec.props!.token).toBe('USDT');
  });

  test('a host request drops where an open flow would have returned to', () => {
    const { props, onViewChange } = setup();
    // Send from All activity without a token: pick one, so the flow returns to All when it ends
    go(props, { view: 'send' }, 1);
    const row = [...document.querySelectorAll<HTMLElement>('.dialog .row')].find((b) => b.textContent?.includes('ICP'))!;
    row.click();
    flushSync();
    expect(flows.send.rec.props!.token).toBe('ICP');
    // the host opens a token page, then a send there: ending that send goes back to the token, not All
    go(props, { view: 'token', token: 'USDT' }, 2);
    go(props, { view: 'send', token: 'USDT' }, 3);
    (flows.send.rec.props!.onClose as () => void)();
    flushSync();
    expect(onViewChange).toHaveBeenLastCalledWith({ view: 'token', token: 'USDT' });
  });

  test('a token-less flow request from a token page uses the token shown there', () => {
    const { props } = setup({ tokens: [{ ...tokens[0], held: 0 }, tokens[1]] });
    go(props, { view: 'token', token: 'ICP' }, 1); // ICP has no balance: the page shows Tether
    go(props, { view: 'swap' }, 2);
    expect(flows.swap.rec.props!.token).toBe('USDT');
  });

  test('Receive offers a receivable token on its own networks', () => {
    const { props } = setup({ receivable: [{ symbol: 'USDC', name: 'USD Coin', mark: '$', grad: 'blue', nets: ['eth', 'icp'] }] });
    go(props, { view: 'receive', token: 'USDC' }, 1);
    const rec = flows.receive.rec.props as { token: string; tokens: WalletToken[] };
    expect(rec.token).toBe('USDC');
    expect(rec.tokens.find((x) => x.symbol === 'USDC')?.nets).toEqual(['eth', 'icp']);
  });

  test('the token page summary: balance, Send / Receive / Swap, facts with a ledger copy, share of wallet', () => {
    const { props } = setup();
    go(props, { view: 'token', token: 'ICP' }, 1);
    const summary = target.querySelector('.summary')!;
    expect(summary.querySelector('.held')!.textContent).toContain('10.0000 ICP');
    expect([...summary.querySelectorAll('.action')].map((a) => a.textContent)).toEqual(['Send ICP', 'Receive ICP', 'Swap ICP']);
    const facts = [...summary.querySelectorAll('.fact-label')].map((f) => f.textContent);
    expect(facts).toEqual(['Price', 'Transfer fee', 'Standard', 'Ledger']);
    expect(summary.querySelector('.fact [role=button]')!.getAttribute('aria-label')).toBe('Copy ledger ID');
    // ICP is $50 of $150
    expect(summary.querySelector('.share-value')!.textContent).toBe('33.3%');
    props.balanceHidden = true;
    flushSync();
    expect(summary.querySelector('.held')!.classList.contains('veiled')).toBe(true);
    expect(summary.querySelector('.share-value')!.textContent).toBe('••••');
  });
});
