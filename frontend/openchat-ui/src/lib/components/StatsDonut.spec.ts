import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import StatsDonut from './StatsDonut.svelte';

describe('StatsDonut', () => {
  let target: HTMLElement;
  let app: object | undefined;
  beforeEach(() => {
    target = document.body.appendChild(document.createElement('div'));
  });
  afterEach(() => {
    if (app) unmount(app);
    app = undefined;
    target.remove();
    vi.restoreAllMocks();
  });

  test.each([
    [
      'all-zero slices',
      [
        { label: 'Text', count: 0, type: 'text' },
        { label: 'Image', count: 0, type: 'image' },
      ],
    ],
    ['no slices', []],
  ])('%s: a zero total renders 0 messages, no NaN', (_, slices) => {
    // jsdom drops a conic-gradient it can't parse, so read the ring's value as it is set
    const set = vi.spyOn(CSSStyleDeclaration.prototype, 'setProperty');
    app = mount(StatsDonut, { target, props: { onlineMinutes: 0, onlineMinutesPrev: 0, slices } });
    flushSync();
    expect(target.querySelector('.total')?.textContent).toBe('0');
    expect(target.innerHTML).not.toContain('NaN');
    expect(target.innerHTML).not.toContain('Infinity');
    const ring = set.mock.calls.find(([name]) => name === 'background')?.[1] ?? '';
    expect(ring).toContain('conic-gradient');
    expect(ring).not.toMatch(/NaN|Infinity/);
  });
});
