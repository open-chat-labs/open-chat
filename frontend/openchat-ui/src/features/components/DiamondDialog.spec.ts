import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import DiamondDialog from './DiamondDialog.svelte';

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
const press = (el: Element | null) => (el as HTMLElement).click();
const esc = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

const tokens = [{ symbol: 'CHAT', name: 'OpenChat', mark: 'C', grad: '', held: 1000, price: 0.05, dp: 4, fee: 0.001, payable: true }];

describe('DiamondDialog pay', () => {
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

  // opens on the confirm step of the one-month plan
  function open(onUpgrade: () => Promise<unknown>) {
    const onClose = vi.fn();
    const upgrade = vi.fn(onUpgrade);
    app = mount(DiamondDialog, { target, props: { tokens, balance: 1000, prices: { '1m': 2, '3m': 5 }, plan: '1m', onUpgrade: upgrade, onClose } });
    flushSync();
    press(target.querySelector('.plan'));
    flushSync();
    return { onClose, upgrade, pay: () => press(target.querySelector('.cta')), layer: target.querySelector('.layer')! };
  }

  test('× then Pay does not charge', async () => {
    const { upgrade, onClose, pay } = open(() => Promise.resolve());
    press(target.querySelector('.square:not(.back)'));
    pay();
    await vi.runAllTimersAsync();
    expect(upgrade).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  test('a second Pay while paying is ignored, and nothing closes', async () => {
    const d = deferred();
    const { upgrade, onClose, pay, layer } = open(() => d.promise);
    pay();
    pay();
    await settle();
    esc();
    press(target.querySelector('.veil'));
    await vi.runAllTimersAsync();
    expect(upgrade).toHaveBeenCalledOnce();
    expect(((upgrade.mock.calls[0] as unknown[])[0])).toMatchObject({ plan: '1m', token: 'CHAT', amount: 2 });
    expect(onClose).not.toHaveBeenCalled();
    expect(layer.classList.contains('closing')).toBe(false);
  });

  test('membership shows only after the host confirms, with the end it set', async () => {
    const d = deferred<{ until: string }>();
    const { pay } = open(() => d.promise);
    pay();
    await settle();
    expect(target.querySelector('.member-line')).toBeNull();
    d.resolve({ until: '2030-01-15T00:00:00.000Z' });
    await settle();
    expect(target.querySelector('.member-line')?.textContent).toContain('2030');
  });

  test('a failed payment stays on confirm with the error and can be retried', async () => {
    const { upgrade, pay } = open(() => Promise.reject(new Error('declined')));
    pay();
    await settle();
    expect(target.querySelector('.pay-error')).not.toBeNull();
    pay();
    await settle();
    expect(upgrade).toHaveBeenCalledTimes(2);
  });
});
