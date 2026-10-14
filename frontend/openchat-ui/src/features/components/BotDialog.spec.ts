import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import BotDialog, { type BotDefinition } from './BotDialog.svelte';

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

const bot: BotDefinition = {
  id: 'bot-1',
  name: 'ReminderBot',
  creator: '@jane',
  perms: ['read', 'send'],
  commands: [{ name: '/remind', about: 'Remind', needs: ['send'] }],
};

describe('BotDialog', () => {
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

  function open(props: Record<string, unknown>) {
    const onCancel = vi.fn();
    app = mount(BotDialog, { target, props: { bot, canManage: true, onCancel, ...props } });
    flushSync();
    return { onCancel, layer: target.querySelector('.layer')! };
  }
  const primary = () => target.querySelector('.primary');

  test('a new install starts with nothing granted and installs once by bot id', async () => {
    const d = deferred();
    const onInstall = vi.fn(() => d.promise);
    open({ onInstall, initialStep: 'configure' });
    press(primary());
    press(primary());
    await settle();
    expect(onInstall).toHaveBeenCalledOnce();
    expect((onInstall.mock.calls[0] as unknown[])[0]).toEqual({ botId: 'bot-1', granted: { read: false, send: false } });
  });

  test('nothing dismisses or goes back while installing; success leaves once', async () => {
    const d = deferred();
    const { onCancel, layer } = open({ onInstall: () => d.promise, initialStep: 'configure' });
    press(primary());
    await settle();
    esc();
    press(target.querySelector('.veil'));
    press(target.querySelector('.close'));
    press(target.querySelector('.secondary'));
    await vi.runAllTimersAsync();
    expect(onCancel).not.toHaveBeenCalled();
    expect(target.querySelector('.perm-toggle')).not.toBeNull(); // still on the configure step
    d.resolve();
    await vi.runAllTimersAsync();
    expect(onCancel).toHaveBeenCalledOnce();
    expect(layer.classList.contains('closing')).toBe(true);
  });

  test('remove passes the bot id; failure keeps the dialog with an error', async () => {
    const onRemove = vi.fn(() => Promise.reject(new Error('x')));
    const { onCancel } = open({ installed: true, onRemove, initialStep: 'remove' });
    press(primary());
    await settle();
    expect(onRemove).toHaveBeenCalledWith({ botId: 'bot-1' });
    expect(target.querySelector('.error')).not.toBeNull();
    expect(onCancel).not.toHaveBeenCalled();
  });

  test('cancel then the primary action during the exit does nothing', async () => {
    const onInstall = vi.fn(() => Promise.resolve());
    const { onCancel } = open({ onInstall, initialStep: 'configure' });
    press(target.querySelector('.close'));
    press(primary());
    await vi.runAllTimersAsync();
    expect(onInstall).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  test('an installed bot with nothing granted has a real sentence, not "Can ."', () => {
    open({ installed: true, bot: { ...bot, granted: {} } });
    const text = target.querySelector('.plain-text')!.textContent!.trim();
    expect(text).not.toMatch(/\s\.$/);
    expect(text).not.toBe('Can .');
  });

  test('view-only users get no actions', () => {
    open({ canManage: false, installed: true, onRemove: vi.fn(), onInstall: vi.fn() });
    expect(primary()).toBeNull();
  });
});
