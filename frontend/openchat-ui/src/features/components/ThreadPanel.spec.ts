import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import ThreadPanel from './ThreadPanel.svelte';
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
const root = { author: 'Ana', color: 'violet', text: 'Scale first?', time: '11:15' };

describe('ThreadPanel follow', () => {
  let target: HTMLElement;
  let app: object;
  beforeEach(() => {
    // jsdom has no ResizeObserver (the composer measures itself)
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    target = document.body.appendChild(document.createElement('div'));
  });
  afterEach(() => {
    unmount(app);
    target.remove();
    vi.unstubAllGlobals();
  });

  function open(props: Record<string, unknown>) {
    const host = reactiveProps<Record<string, unknown>>({ chatName: 'Devs', threadKey: 't1', root, ...props });
    app = mount(ThreadPanel, { target, props: host as never });
    flushSync();
    return host;
  }
  const button = () => target.querySelector<HTMLElement>('.follow')!;
  const isOn = () => button().getAttribute('aria-pressed') === 'true';
  const press = () => {
    button().click();
    flushSync();
  };

  const isBusy = () => button().getAttribute('aria-busy') === 'true';

  test('shows a spinner while the host is asked, then the change once it accepts', async () => {
    const d = deferred();
    const onFollowChange = vi.fn(() => d.promise);
    open({ following: false, onFollowChange });
    press();
    expect(onFollowChange).toHaveBeenCalledWith(true);
    expect(isBusy()).toBe(true);
    expect(isOn()).toBe(false);
    d.resolve();
    await settle();
    expect(isBusy()).toBe(false);
    expect(isOn()).toBe(true);
  });

  test('takes no second press while the host is asked; a rejection keeps the state from before', async () => {
    const d = deferred();
    const onFollowChange = vi.fn(() => d.promise);
    open({ following: false, onFollowChange });
    press(); // follow
    press(); // ignored
    expect(onFollowChange.mock.calls).toEqual([[true]]);
    d.reject(new Error('x'));
    await settle();
    expect(isBusy()).toBe(false);
    expect(isOn()).toBe(false);
  });

  test('falls back to the value the host last accepted, not an earlier guess', async () => {
    const results = [() => Promise.resolve(), () => Promise.reject(new Error('x'))];
    open({ following: false, onFollowChange: () => results.shift()!() });
    press(); // follow, accepted
    await settle();
    press(); // unfollow, rejected
    await settle();
    expect(isOn()).toBe(true);
  });

  test('a new host value is followed, and another thread starts from the host', async () => {
    const host = open({ following: false, onFollowChange: () => Promise.resolve() });
    press();
    await settle();
    expect(isOn()).toBe(true);
    host.following = true; // host catches up
    flushSync();
    host.following = false; // unfollowed elsewhere
    flushSync();
    expect(isOn()).toBe(false);
    press();
    await settle();
    host.threadKey = 't2'; // a different thread, host says not following
    flushSync();
    expect(isOn()).toBe(false);
  });
});
