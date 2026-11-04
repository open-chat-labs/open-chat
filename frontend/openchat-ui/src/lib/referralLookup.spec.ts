import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ReferralLookup } from './referralLookup.svelte';

const LINK = 'https://oc.app/?ref=lucy-id';

function setup(resolve: (code: string) => Promise<string | undefined>) {
  const found: string[] = [];
  const lookup = new ReferralLookup<string>(() => resolve, (p) => found.push(p), { settleMs: 450, timeoutMs: 10_000 });
  return { lookup, found };
}

describe('ReferralLookup', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test('a paste is looked up at once, and pending until it answers', async () => {
    const resolve = vi.fn(async (code: string) => (code === 'lucy-id' ? 'Lucy' : undefined));
    const { lookup, found } = setup(resolve);
    lookup.input(LINK, true);
    expect(resolve).toHaveBeenCalledWith('lucy-id');
    expect(lookup.pending).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(found).toEqual(['Lucy']);
    expect(lookup.pending).toBe(false);
  });

  test('typing is looked up once it settles, not per keystroke, and pending meanwhile', async () => {
    const resolve = vi.fn(async () => 'Lucy');
    const { lookup } = setup(resolve);
    lookup.input('https://oc.app/?ref=l', false);
    lookup.input('https://oc.app/?ref=lu', false);
    expect(lookup.pending).toBe(true);
    await vi.advanceTimersByTimeAsync(449);
    expect(resolve).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(resolve).toHaveBeenCalledOnce();
    expect(resolve).toHaveBeenCalledWith('lu');
  });

  test('only the latest text answers', async () => {
    let answer!: (p: string | undefined) => void;
    const resolve = vi.fn(() => new Promise<string | undefined>((r) => (answer = r)));
    const { lookup, found } = setup(resolve);
    lookup.input(LINK, true);
    const first = answer;
    lookup.input('https://oc.app/?ref=matt-id', true);
    first('Lucy');
    answer('Matt');
    await vi.advanceTimersByTimeAsync(0);
    expect(found).toEqual(['Matt']);
  });

  test('a lookup that hangs counts as naming no one after the timeout', async () => {
    const { lookup, found } = setup(() => new Promise(() => {}));
    lookup.input(LINK, true);
    await vi.advanceTimersByTimeAsync(9_999);
    expect(lookup.pending).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(lookup.pending).toBe(false);
    expect(lookup.problem).toBe('unknown');
    expect(found).toEqual([]);
  });

  test('stop() drops a lookup going, so nothing waits on it and its answer is ignored', async () => {
    let answer!: (p: string | undefined) => void;
    const { lookup, found } = setup(() => new Promise((r) => (answer = r)));
    lookup.input(LINK, true);
    lookup.stop();
    expect(lookup.pending).toBe(false);
    answer('Lucy');
    await vi.advanceTimersByTimeAsync(0);
    expect(found).toEqual([]);
  });

  test('text that is no link says so once it is long enough; short text is still being typed', async () => {
    const resolve = vi.fn(async () => 'Lucy');
    const { lookup } = setup(resolve);
    lookup.input('lucy', false);
    expect(lookup.pending).toBe(false);
    lookup.input('lucy linden', false);
    await vi.advanceTimersByTimeAsync(450);
    expect(lookup.problem).toBe('no_referrer');
    expect(resolve).not.toHaveBeenCalled();
  });

  test('a link naming no one, or a lookup that fails, is unknown', async () => {
    const { lookup } = setup(async () => {
      throw new Error('offline');
    });
    lookup.input(LINK, true);
    await vi.advanceTimersByTimeAsync(0);
    expect(lookup.problem).toBe('unknown');
  });
});
