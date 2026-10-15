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

  test('shows the change at once and keeps it when the host accepts', async () => {
    const d = deferred();
    const onFollowChange = vi.fn(() => d.promise);
    open({ following: false, onFollowChange });
    press();
    expect(onFollowChange).toHaveBeenCalledWith(true);
    expect(isOn()).toBe(true);
    d.resolve();
    await settle();
    expect(isOn()).toBe(true);
  });

  test('the latest change wins; a rejected latest change falls back to the host', async () => {
    const a = deferred(), b = deferred();
    const calls = [a, b];
    const onFollowChange = vi.fn(() => calls.shift()!.promise);
    open({ following: false, onFollowChange });
    press(); // follow
    press(); // unfollow
    expect(onFollowChange.mock.calls).toEqual([[true], [false]]);
    a.reject(new Error('late')); // superseded
    await settle();
    expect(isOn()).toBe(false);
    b.reject(new Error('x'));
    await settle();
    expect(isOn()).toBe(false); // the host's value
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
