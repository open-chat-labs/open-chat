import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import ChitDialog from './ChitDialog.svelte';

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

describe('ChitDialog claim', () => {
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

  function open(onClaim?: (r: { amount: number }) => Promise<void>) {
    const onClose = vi.fn();
    const onAction = vi.fn();
    const claim = onClaim ? vi.fn(onClaim) : undefined;
    app = mount(ChitDialog, { target, props: { streak: 5, balance: 100, earned: 1000, daily: 50, claimable: true, onClaim: claim, onAction, onClose } });
    flushSync();
    return { onClose, onAction, claim, layer: target.querySelector('.layer')! };
  }

  test('a second press while claiming is ignored', async () => {
    const d = deferred();
    const { claim } = open(() => d.promise);
    press(target.querySelector('.claim'));
    press(target.querySelector('.claim'));
    await settle();
    expect(claim).toHaveBeenCalledOnce();
    expect(claim).toHaveBeenCalledWith({ amount: 50 });
  });

  test('nothing closes or opens another dialog while claiming', async () => {
    const d = deferred();
    const { onClose, onAction, layer } = open(() => d.promise);
    press(target.querySelector('.claim'));
    await settle();
    esc();
    press(target.querySelector('.veil'));
    press(target.querySelector('.row.cover'));
    await vi.runAllTimersAsync();
    expect(onClose).not.toHaveBeenCalled();
    expect(onAction).not.toHaveBeenCalled();
    expect(layer.classList.contains('closing')).toBe(false);
  });

  test('shows the claim only once the host confirms', async () => {
    const d = deferred();
    open(() => d.promise);
    press(target.querySelector('.claim'));
    await settle();
    expect(target.querySelector('.claimed')).toBeNull();
    d.resolve();
    await settle();
    expect(target.querySelector('.claimed')).not.toBeNull();
    expect(target.querySelector('.claim')).toBeNull();
  });

  test('a rejected claim shows the error and can be retried', async () => {
    const { claim } = open(() => Promise.reject(new Error('no')));
    press(target.querySelector('.claim'));
    await settle();
    expect(target.querySelector('.note.error')).not.toBeNull();
    expect(target.querySelector('.claimed')).toBeNull();
    press(target.querySelector('.claim'));
    await settle();
    expect(claim).toHaveBeenCalledTimes(2);
  });

  test('a claim pressed while closing is ignored', async () => {
    const claim = vi.fn(() => Promise.resolve());
    const { onClose } = open(claim);
    press(target.querySelector('.veil'));
    press(target.querySelector('.claim'));
    await vi.runAllTimersAsync();
    expect(claim).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  test('without onClaim there is no claim button', () => {
    open();
    expect(target.querySelector('.claim')).toBeNull();
  });
});
