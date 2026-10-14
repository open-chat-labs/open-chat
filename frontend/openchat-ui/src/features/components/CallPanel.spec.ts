import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import CallPanel from './CallPanel.svelte';

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
const people = [{ id: 'u-1', name: 'julian', initial: 'J', grad: 'linear-gradient(#000,#111)' }];

describe('CallPanel camera', () => {
  let target: HTMLElement;
  let app: object;
  beforeEach(() => {
    target = document.body.appendChild(document.createElement('div'));
  });
  afterEach(() => {
    unmount(app);
    target.remove();
  });

  function open(onToggleCamera?: (on: boolean) => Promise<void>) {
    app = mount(CallPanel, { target, props: { title: 'Julian', people, media: 'video', camera: true, onToggleCamera } });
    flushSync();
  }
  const button = () => target.querySelector<HTMLElement>('[aria-label^="Turn camera"]');
  const camOn = () => button()!.getAttribute('aria-label') === 'Turn camera off';

  test('flips at once; a rejected latest call falls back to the host value with an error', async () => {
    const d = deferred();
    open(() => d.promise);
    button()!.click();
    flushSync();
    expect(camOn()).toBe(false);
    d.reject(new Error('no'));
    await settle();
    expect(camOn()).toBe(true);
    expect(target.querySelector('[role=alert]')).not.toBeNull();
  });

  test('latest wins: an older rejection after a newer accepted change is ignored', async () => {
    const calls: ReturnType<typeof deferred>[] = [];
    open(() => {
      const d = deferred();
      calls.push(d);
      return d.promise;
    });
    button()!.click(); // off
    flushSync();
    button()!.click(); // on
    flushSync();
    button()!.click(); // off
    flushSync();
    calls[2].resolve();
    await settle();
    calls[0].reject(new Error('late'));
    calls[1].reject(new Error('late'));
    await settle();
    expect(camOn()).toBe(false);
    expect(target.querySelector('[role=alert]')).toBeNull();
  });

  test('no camera button without onToggleCamera', () => {
    open();
    expect(button()).toBeNull();
  });
});
