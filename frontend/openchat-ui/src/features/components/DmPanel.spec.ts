import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import DmPanel from './DmPanel.svelte';
import { reactiveProps } from '../../lib/testing/reactiveProps.svelte';

const deferred = () => {
  let resolve!: () => void, reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};
const settle = async () => {
  await new Promise((r) => setTimeout(r, 0));
  flushSync();
};

describe('DmPanel toggles', () => {
  let target: HTMLElement;
  let app: object;
  beforeEach(() => {
    target = document.body.appendChild(document.createElement('div'));
  });
  afterEach(() => {
    unmount(app);
    target.remove();
  });

  function open(props: Record<string, unknown>) {
    const host = reactiveProps<Record<string, unknown>>({ title: 'Ana', memberSince: 'Sep 2021', chit: '1,200', ...props });
    app = mount(DmPanel, { target, props: host as never });
    flushSync();
    return host;
  }
  const favPill = () => target.querySelector<HTMLElement>('.pill.fav')!;
  const isFav = () => favPill().getAttribute('aria-pressed') === 'true';
  const mutePill = () => target.querySelector<HTMLElement>('.pill.mute')!;
  const error = () => target.querySelector('[role=alert]');
  const press = (el: HTMLElement) => {
    el.click();
    flushSync();
  };
  const option = (text: RegExp) => [...target.querySelectorAll<HTMLElement>('.mute-option')].find((o) => text.test(o.textContent ?? ''))!;

  test('favourite: the latest change wins and an older rejection is ignored', async () => {
    const a = deferred(), b = deferred();
    const calls = [a, b];
    const onToggleFavourite = vi.fn(() => calls.shift()!.promise);
    open({ fav: false, onToggleFavourite });
    press(favPill());
    press(favPill());
    expect(onToggleFavourite.mock.calls).toEqual([[true], [false]]);
    b.resolve();
    a.reject(new Error('late'));
    await settle();
    expect(isFav()).toBe(false);
    expect(error()).toBeNull();
  });

  test('favourite: both changes rejected ends on the host value with an error', async () => {
    const onToggleFavourite = vi.fn(() => Promise.reject(new Error('x')));
    open({ fav: false, onToggleFavourite });
    press(favPill());
    press(favPill());
    await settle();
    expect(isFav()).toBe(false);
    expect(error()).not.toBeNull();
  });

  test('unmute shows at once (an optimistic null is a value, not "absent")', async () => {
    const d = deferred();
    const onMuteChange = vi.fn(() => d.promise);
    open({ muted: '8h', onMuteChange });
    expect(mutePill().textContent).toMatch(/Muted · 8h/);
    press(mutePill());
    press(option(/Unmute/));
    expect(onMuteChange).toHaveBeenCalledWith(null);
    expect(mutePill().textContent).not.toMatch(/Muted/);
    d.resolve();
    await settle();
    expect(mutePill().textContent).not.toMatch(/Muted/);
  });

  test('a rejected mute falls back to the host and a new host value is followed', async () => {
    const host = open({ muted: null, onMuteChange: () => Promise.reject(new Error('x')) });
    press(mutePill());
    press(option(/1 week/));
    await settle();
    expect(mutePill().textContent).not.toMatch(/Muted/);
    expect(error()).not.toBeNull();
    host.muted = '8h'; // muted elsewhere
    flushSync();
    expect(mutePill().textContent).toMatch(/Muted · 8h/);
  });
});
