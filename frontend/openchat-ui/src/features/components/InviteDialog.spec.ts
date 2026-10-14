import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import InviteDialog from './InviteDialog.svelte';

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
const press = (el: Element | null | undefined) => (el as HTMLElement).click();
const esc = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

const people = [
  { id: 'u-a', name: 'Alice', handle: '@alice', color: 'violet' as const, frequent: true },
  { id: 'u-b', name: 'Bob', handle: '@bob', color: 'teal' as const, frequent: true },
];

describe('InviteDialog', () => {
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
    app = mount(InviteDialog, { target, props: { groupName: 'Devs', people, canInvite: true, onCancel, ...props } });
    flushSync();
    return { onCancel };
  }
  const row = (name: string) => [...target.querySelectorAll('[role=button]')].find((el) => el.textContent?.includes(name) && el.querySelector('.icon-button, [class*=title]'));
  const pick = (name: string) => {
    press(row(name));
    flushSync();
  };
  const cta = () => target.querySelector('.cta');

  test('invites by id once; nothing dismisses while sending', async () => {
    const d = deferred();
    const onInvite = vi.fn(() => d.promise);
    const { onCancel } = open({ onInvite });
    pick('Alice');
    press(cta());
    press(cta());
    await settle();
    esc();
    press(target.querySelector('.veil'));
    press(target.querySelector('.cancel'));
    await vi.runAllTimersAsync();
    expect(onInvite).toHaveBeenCalledOnce();
    expect(onInvite).toHaveBeenCalledWith(['u-a']);
    expect(onCancel).not.toHaveBeenCalled();
    d.resolve();
    await settle();
    press(target.querySelector('.cancel'));
    await vi.runAllTimersAsync();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  test('someone picked while the invite was pending stays picked', async () => {
    const d = deferred();
    const onInvite = vi.fn(() => d.promise);
    open({ onInvite });
    pick('Alice');
    press(cta());
    await settle();
    pick('Bob');
    d.resolve();
    await settle();
    press(cta());
    await settle();
    expect(onInvite).toHaveBeenLastCalledWith(['u-b']);
  });

  test('a failed invite keeps the picks for a retry', async () => {
    const onInvite = vi.fn(() => Promise.reject(new Error('x')));
    open({ onInvite });
    pick('Alice');
    press(cta());
    await settle();
    press(cta());
    await settle();
    expect(onInvite).toHaveBeenCalledTimes(2);
    expect(onInvite).toHaveBeenLastCalledWith(['u-a']);
  });

  test('sharing switch falls back to the host value when the latest change is rejected', async () => {
    const d = deferred();
    const onShareToggle = vi.fn(() => d.promise);
    open({ initialTab: 'share', shareOn: true, shareLink: 'https://oc.app/g/x', onShareToggle });
    const sw = target.querySelector('.toggle [role=switch]') as HTMLElement;
    press(sw);
    flushSync();
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(onShareToggle).toHaveBeenCalledWith(false);
    d.reject(new Error('x'));
    await settle();
    expect(sw.getAttribute('aria-checked')).toBe('true');
  });

  test('Esc closes when nothing is pending', async () => {
    const { onCancel } = open({});
    esc();
    esc();
    await vi.runAllTimersAsync();
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
