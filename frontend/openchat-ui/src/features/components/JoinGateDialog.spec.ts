import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import JoinGateDialog from './JoinGateDialog.svelte';

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

describe('JoinGateDialog join', () => {
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

  function open(onJoin: () => Promise<void>) {
    const onClose = vi.fn();
    const join = vi.fn(onJoin);
    app = mount(JoinGateDialog, {
      target,
      props: {
        community: { name: 'Devs' },
        gates: [{ kind: 'pay', symbol: 'CHAT', amount: 50, ledger: 'ledger-chat' }],
        tokens: [{ symbol: 'CHAT', held: 1000, mark: 'C', grad: '' }],
        ownerShare: 0.98,
        onJoin: join,
        onClose,
      },
    });
    flushSync();
    return { onClose, join, cta: target.querySelector('.cta') };
  }

  test('pays once, by ledger, even when pressed twice', async () => {
    const d = deferred();
    const { join, cta } = open(() => d.promise);
    press(cta);
    press(cta);
    await settle();
    expect(join).toHaveBeenCalledOnce();
    expect(join).toHaveBeenCalledWith({ paid: [{ ledger: 'ledger-chat', symbol: 'CHAT', amount: 50 }], neuronConfirmed: false });
  });

  test('cannot be closed while paying', async () => {
    const d = deferred();
    const { onClose, cta } = open(() => d.promise);
    press(cta);
    await settle();
    esc();
    press(target.querySelector('.scrim'));
    await vi.runAllTimersAsync();
    expect(onClose).not.toHaveBeenCalled();
  });

  test('joined: hands back to the host once, and nothing more can be paid', async () => {
    const d = deferred();
    const { onClose, join, cta } = open(() => d.promise);
    press(cta);
    d.resolve();
    await settle();
    press(cta);
    await vi.runAllTimersAsync();
    expect(onClose).toHaveBeenCalledOnce();
    expect(join).toHaveBeenCalledOnce();
  });

  test('a failed join shows the error, keeps the dialog and allows a retry', async () => {
    const { onClose, join, cta } = open(() => Promise.reject(new Error('no')));
    press(cta);
    await settle();
    expect(target.querySelector('.reason.failed')).not.toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    press(cta);
    await settle();
    expect(join).toHaveBeenCalledTimes(2);
  });

  test('closes at once when idle (DialogShell has no exit animation to wait for)', async () => {
    const { onClose } = open(() => Promise.resolve());
    esc();
    await vi.advanceTimersByTimeAsync(0);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
