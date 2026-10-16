import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';
import NavRail from './NavRail.svelte';

describe('NavRail', () => {
  afterEach(() => vi.restoreAllMocks());

  test('unmounting while it lines up its active bar throws nothing', async () => {
    const errors: unknown[] = [];
    const onError = (e: ErrorEvent) => errors.push(e.error);
    const onRejection = (e: PromiseRejectionEvent) => errors.push(e.reason);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    const target = document.body.appendChild(document.createElement('div'));
    const rail = mount(NavRail, {
      target,
      props: { items: [{ icon: 'messages' }], pins: [], profileLabel: '', profileHandle: '', activeIndex: 0 },
    });
    flushSync();
    // the bar waits a tick before measuring; the rail goes before it does
    unmount(rail);
    await tick();
    await new Promise((resolve) => setTimeout(resolve));
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
    target.remove();
    expect(errors).toEqual([]);
  });
});
