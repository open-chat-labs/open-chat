import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import InfoPanel from './InfoPanel.svelte';
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
const toggles = [{ title: 'Disappearing messages', hint: '', on: false, disappearing: true }];

describe('InfoPanel disappearing messages', () => {
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
    const host = reactiveProps<Record<string, unknown>>({ title: 'Ana', toggles, disappearOn: false, disappearAfter: '12 hours', ...props });
    app = mount(InfoPanel, { target, props: host as never });
    flushSync();
    return host;
  }
  const sw = () => target.querySelector<HTMLElement>('.setting-toggle [role=switch]')!;
  const isOn = () => sw().getAttribute('aria-checked') === 'true';
  const chip = (text: RegExp) => [...target.querySelectorAll<HTMLElement>('.chip')].find((c) => text.test(c.textContent ?? ''))!;
  const selected = () => target.querySelector('.chip.selected')?.textContent;
  const error = () => target.querySelector('[role=alert]');
  const press = (el: HTMLElement) => {
    el.click();
    flushSync();
  };

  test('turning it on reports on + duration and shows at once', async () => {
    const d = deferred();
    const onDisappearChange = vi.fn(() => d.promise);
    open({ onDisappearChange });
    press(sw());
    expect(onDisappearChange).toHaveBeenCalledWith(expect.objectContaining({ on: true, after: '12 hours', afterMs: 12 * 3600_000 }));
    expect(isOn()).toBe(true);
    d.resolve();
    await settle();
    expect(isOn()).toBe(true);
  });

  test('the latest duration wins over an older rejection', async () => {
    const calls: ReturnType<typeof deferred>[] = [];
    const onDisappearChange = vi.fn(() => {
      const d = deferred();
      calls.push(d);
      return d.promise;
    });
    open({ disappearOn: true, onDisappearChange });
    press(chip(/1 hour/));
    press(chip(/1 day/));
    calls[1].resolve();
    calls[0].reject(new Error('late'));
    await settle();
    expect(selected()).toMatch(/1 day/);
    expect(error()).toBeNull();
  });

  test('a rejected latest change falls back to the host value with an error', async () => {
    open({ disappearOn: false, onDisappearChange: () => Promise.reject(new Error('x')) });
    press(sw());
    await settle();
    expect(isOn()).toBe(false);
    expect(error()).not.toBeNull();
  });

  test('after a change, a new host value is followed once nothing is in flight', async () => {
    const host = open({ disappearOn: false, onDisappearChange: () => Promise.resolve() });
    press(sw()); // on, accepted
    await settle();
    expect(isOn()).toBe(true);
    host.disappearOn = true; // the host catches up
    flushSync();
    host.disappearOn = false; // then it's turned off elsewhere
    flushSync();
    expect(isOn()).toBe(false);
  });
});
