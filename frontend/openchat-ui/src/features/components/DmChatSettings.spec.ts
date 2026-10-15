import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import DmChatSettings from './DmChatSettings.svelte';

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

describe('DmChatSettings read receipts', () => {
  let target: HTMLElement;
  let app: object;
  beforeEach(() => {
    target = document.body.appendChild(document.createElement('div'));
  });
  afterEach(() => {
    unmount(app);
    target.remove();
  });

  function open(onReadReceiptsChange: (on: boolean) => Promise<void>, readReceipts = false) {
    const spy = vi.fn(onReadReceiptsChange);
    app = mount(DmChatSettings, { target, props: { peerName: 'Ana Ferreira', readReceipts, onReadReceiptsChange: spy } });
    flushSync();
    // the read-receipts switch is the last one (the first belongs to the disappearing-messages toggle)
    const sw = () => [...target.querySelectorAll<HTMLElement>('[role=switch]')].at(-1)!;
    return { spy, sw, isOn: () => sw().getAttribute('aria-checked') === 'true', error: () => target.querySelector('[role=alert]') };
  }

  test('shows the change at once and keeps it when the host accepts', async () => {
    const d = deferred();
    const { sw, isOn, error } = open(() => d.promise);
    sw().click();
    flushSync();
    expect(isOn()).toBe(true);
    d.resolve();
    await settle();
    expect(isOn()).toBe(true);
    expect(error()).toBeNull();
  });

  test('an older rejection after a newer change is ignored (latest wins)', async () => {
    const calls: ReturnType<typeof deferred>[] = [];
    const { sw, isOn, error } = open(() => {
      const d = deferred();
      calls.push(d);
      return d.promise;
    });
    sw().click(); // on
    flushSync();
    sw().click(); // off
    flushSync();
    calls[1].resolve();
    await settle();
    calls[0].reject(new Error('late'));
    await settle();
    expect(isOn()).toBe(false);
    expect(error()).toBeNull();
  });

  test('a rejected latest change falls back to the host value with an error', async () => {
    const calls: ReturnType<typeof deferred>[] = [];
    const { sw, isOn, error } = open(() => {
      const d = deferred();
      calls.push(d);
      return d.promise;
    });
    sw().click(); // on (guess)
    flushSync();
    sw().click(); // off (guess)
    flushSync();
    calls[0].reject(new Error('x'));
    calls[1].reject(new Error('y'));
    await settle();
    expect(isOn()).toBe(false); // the host's own value, not the first guess
    expect(error()).not.toBeNull();
  });

  test('falls back to the value the host last accepted', async () => {
    const calls: ReturnType<typeof deferred>[] = [];
    const { sw, isOn } = open(() => {
      const d = deferred();
      calls.push(d);
      return d.promise;
    });
    sw().click(); // on, accepted
    flushSync();
    calls[0].resolve();
    await settle();
    sw().click(); // off, rejected
    flushSync();
    calls[1].reject(new Error('x'));
    await settle();
    expect(isOn()).toBe(true);
  });
});
