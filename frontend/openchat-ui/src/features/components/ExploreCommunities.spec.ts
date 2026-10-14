import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { reactiveProps } from '../../lib/testing/reactiveProps.svelte';
import ExploreCommunities, { type ExploreCommunity } from './ExploreCommunities.svelte';

const page = (prefix: string, from: number, n: number): ExploreCommunity[] =>
  Array.from({ length: n }, (_, i) => ({ key: `${prefix}${from + i}`, name: `${prefix} community ${from + i}`, members: 1000 - from - i }));

describe('ExploreCommunities with onQuery', () => {
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
    const onQuery = vi.fn();
    const props = reactiveProps({ communities: page('Old', 0, 6), total: 6, loading: false, onQuery });
    app = mount(ExploreCommunities, { target, props });
    flushSync();
    return { props, onQuery };
  }
  function type(text: string) {
    const input = target.querySelector<HTMLInputElement>('input')!;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    flushSync();
  }
  const text = () => target.textContent ?? '';
  const searching = () => !!target.querySelector('.results [role=status][aria-busy=true]');

  test('shows "Searching…" (not the previous results) until the host has answered for the text', async () => {
    const { props, onQuery } = open();
    type('rust');
    expect(searching()).toBe(true);
    expect(text()).not.toContain('BEST MATCH');
    await vi.advanceTimersByTimeAsync(250);
    flushSync();
    expect(onQuery).toHaveBeenLastCalledWith(expect.objectContaining({ text: 'rust', offset: 0 }));
    props.loading = true;
    flushSync();
    expect(searching()).toBe(true);
    props.communities = page('Rust', 0, 6);
    props.total = 20;
    props.loading = false;
    flushSync();
    expect(searching()).toBe(false);
    expect(text()).toContain('Rust community 0');
    expect(text()).not.toContain('Old community');
  });

  test('Load more under the search results asks for the next page at the loaded count', async () => {
    const { props, onQuery } = open();
    type('rust');
    await vi.advanceTimersByTimeAsync(250);
    props.communities = page('Rust', 0, 6);
    props.total = 20;
    flushSync();
    expect(text()).toContain('Showing 6 of 20');
    (target.querySelector('.load-more') as HTMLElement).click();
    expect(onQuery).toHaveBeenLastCalledWith(expect.objectContaining({ text: 'rust', offset: 6 }));
    // loading the next page keeps the current results on screen
    props.loading = true;
    flushSync();
    expect(text()).toContain('Rust community 0');
    props.communities = [...page('Rust', 0, 6), ...page('Rust', 6, 6)];
    props.loading = false;
    flushSync();
    expect(text()).toContain('Showing 12 of 20');
  });

  test('no Load more once everything is loaded', async () => {
    const { props } = open();
    type('rust');
    await vi.advanceTimersByTimeAsync(250);
    props.communities = page('Rust', 0, 4);
    props.total = 4;
    flushSync();
    expect(target.querySelector('.results .load-more')).toBeNull();
  });

  test('typing again before the host answers goes back to "Searching…"', async () => {
    const { props } = open();
    type('rust');
    await vi.advanceTimersByTimeAsync(250);
    props.communities = page('Rust', 0, 6);
    flushSync();
    type('rusty');
    expect(searching()).toBe(true);
  });
});
