import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
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
    app = mount(CallPanel, {
      target,
      props: { title: 'Julian', people, media: 'video', camera: true, onToggleCamera },
    });
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

describe('CallPanel full screen controls', () => {
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

  function open() {
    app = mount(CallPanel, {
      target,
      props: { title: 'Julian', people, full: true, onLeave: () => {} },
    });
    flushSync();
    return target.querySelector<HTMLElement>('.call')!;
  }
  const hidden = () => target.querySelector('.call')!.classList.contains('idle');

  test('hide after 3s; a key press brings them back', () => {
    const call = open();
    vi.advanceTimersByTime(3000);
    flushSync();
    expect(hidden()).toBe(true);
    call.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    flushSync();
    expect(hidden()).toBe(false);
  });

  test('a tap (pointerdown) brings them back', () => {
    const call = open();
    vi.advanceTimersByTime(3000);
    flushSync();
    call.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    flushSync();
    expect(hidden()).toBe(false);
  });

  test('they stay while keyboard focus is on a control, and hide once it leaves', () => {
    open();
    const leave = target.querySelector<HTMLElement>('.pill [tabindex="0"], .pill button')!;
    leave.focus();
    flushSync();
    vi.advanceTimersByTime(10_000);
    flushSync();
    expect(hidden()).toBe(false);
    leave.blur();
    flushSync();
    vi.advanceTimersByTime(3000);
    flushSync();
    expect(hidden()).toBe(true);
  });
});

describe('CallPanel sharing strip', () => {
  let target: HTMLElement;
  let app: object;
  beforeEach(() => {
    target = document.body.appendChild(document.createElement('div'));
  });
  afterEach(() => {
    unmount(app);
    target.remove();
  });

  test('while sharing, the strip shows each camera feed, yours included', () => {
    const theirs = { id: 'their-cam' } as unknown as MediaStream;
    const mine = { id: 'my-cam' } as unknown as MediaStream;
    app = mount(CallPanel, {
      target,
      props: {
        title: 'Julian',
        people: [
          { ...people[0], stream: theirs },
          { id: 'u-2', name: 'ana', initial: 'A', grad: 'red' },
        ],
        media: 'video',
        camera: true,
        sharing: true,
        self: { stream: mine },
      },
    });
    flushSync();
    const feeds = [...target.querySelectorAll<HTMLVideoElement>('.strip video')].map((v) => v.srcObject);
    expect(feeds).toEqual([theirs, mine]);
    // no stream: the avatar
    expect(target.querySelectorAll('.strip .strip-avatar').length).toBe(1);
    expect([...target.querySelectorAll<HTMLVideoElement>('.strip video')].every((v) => v.muted)).toBe(true);
  });
});
