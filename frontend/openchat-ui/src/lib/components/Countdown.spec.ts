import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { reactiveProps } from '../testing/reactiveProps.svelte';
import Countdown from './Countdown.svelte';

describe('Countdown', () => {
  let target: HTMLElement;
  let app: object | undefined;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    target = document.body.appendChild(document.createElement('div'));
  });
  afterEach(() => {
    if (app) unmount(app);
    app = undefined;
    target.remove();
    vi.useRealTimers();
  });

  test.each(['', 'not a date'])('to=%j (e.g. before data loads) renders nothing, never "Ended", and fires no onEnd', async (to) => {
    const onEnd = vi.fn();
    app = mount(Countdown, { target, props: { to, onEnd } });
    flushSync();
    await vi.advanceTimersByTimeAsync(5000);
    expect(target.textContent?.trim()).toBe('');
    expect(target.textContent).not.toContain('NaN');
    expect(onEnd).not.toHaveBeenCalled();
  });

  test('starts counting once a valid `to` arrives', async () => {
    const props = reactiveProps({ to: '' as string | number, format: 'clock' as const });
    app = mount(Countdown, { target, props });
    flushSync();
    props.to = Date.now() + 65_000;
    flushSync();
    expect(target.textContent).toContain('1:05');
    await vi.advanceTimersByTimeAsync(5000);
    flushSync();
    expect(target.textContent).toContain('1:00');
  });
});
