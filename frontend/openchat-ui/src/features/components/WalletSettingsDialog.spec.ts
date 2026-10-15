import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { WalletToken } from '../../lib/types';
import WalletSettingsDialog from './WalletSettingsDialog.svelte';

const deferred = <T>() => {
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
const esc = () => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  flushSync();
};
const tokens: WalletToken[] = [
  { symbol: 'ICP', name: 'Internet Computer', mark: '∞', grad: 'red', held: 10, price: 5, dp: 4 },
  { symbol: 'CHAT', name: 'OpenChat', mark: 'C', grad: 'teal', held: 100, price: 0.05, dp: 4 },
];

describe('WalletSettingsDialog Esc', () => {
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

  function open(props: Record<string, unknown> = {}) {
    const onCancel = vi.fn();
    app = mount(WalletSettingsDialog, { target, props: { tokens, onCancel, ...props } });
    flushSync();
    return { onCancel, layer: target.querySelector('.layer')! };
  }
  const addRecipient = () => {
    target.querySelector<HTMLElement>('.add')!.click();
    flushSync();
  };
  const recipientSheetOpen = () => !!target.querySelector('.address-input');

  test('Esc closes an open recipient sheet first, then the dialog', async () => {
    const { onCancel, layer } = open({ section: 'recipients' });
    addRecipient();
    expect(recipientSheetOpen()).toBe(true);
    esc();
    expect(recipientSheetOpen()).toBe(false);
    expect(layer.classList.contains('closing')).toBe(false);
    await vi.runAllTimersAsync();
    expect(onCancel).not.toHaveBeenCalled();
    esc();
    await vi.runAllTimersAsync();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  test('Esc closes the token list sheet first', async () => {
    const { onCancel } = open({ section: 'tokens' });
    target.querySelector<HTMLElement>('.list-card')!.click();
    flushSync();
    expect(target.querySelector('.list-sheet')).not.toBeNull();
    esc();
    expect(target.querySelector('.list-sheet')).toBeNull();
    await vi.runAllTimersAsync();
    expect(onCancel).not.toHaveBeenCalled();
  });

  test('Esc does nothing while a recipient save is pending', async () => {
    const d = deferred<{ id: string; name: string; address: string; token: null }>();
    const { onCancel } = open({ section: 'recipients', onSaveRecipient: () => d.promise });
    addRecipient();
    const input = target.querySelector<HTMLInputElement>('.address-input')!;
    input.value = '5sj6i-pqaaa-aaaaf-a3cmq-cai';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    target.querySelector<HTMLElement>('.sheet-foot .primary')!.click();
    await settle();
    esc();
    esc();
    await vi.runAllTimersAsync();
    expect(recipientSheetOpen()).toBe(true);
    expect(onCancel).not.toHaveBeenCalled();
    d.resolve({ id: 'r1', name: 'X', address: '5sj6i-pqaaa-aaaaf-a3cmq-cai', token: null });
    await settle();
    expect(recipientSheetOpen()).toBe(false);
  });
});
