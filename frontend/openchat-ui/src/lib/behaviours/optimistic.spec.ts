import { describe, expect, test } from 'vitest';
import { Optimistic } from './optimistic.svelte';

const deferred = () => {
  let resolve!: () => void, reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
};
const flush = () => new Promise((r) => setTimeout(r, 0));

function setup(initial: string) {
  let host = initial;
  const value = new Optimistic(() => host);
  return { value, setHost: (v: string) => ((host = v), value.sync()) };
}

describe('Optimistic', () => {
  test('shows the new value at once and keeps it when the host accepts', async () => {
    const { value } = setup('off');
    const d = deferred();
    const done = value.set('on', () => d.promise);
    expect(value.current).toBe('on');
    expect(value.pending).toBe(true);
    d.resolve();
    expect(await done).toBe(true);
    expect(value.current).toBe('on');
    expect(value.failed).toBe(false);
  });

  test('a rejected latest call falls back to the host value and sets failed', async () => {
    const { value } = setup('off');
    expect(await value.set('on', () => Promise.reject(new Error('x')))).toBe(false);
    expect(value.current).toBe('off');
    expect(value.failed).toBe(true);
  });

  test('an older rejection after a newer request is ignored', async () => {
    const { value } = setup('none');
    const a = deferred(), b = deferred();
    const first = value.set('1h', () => a.promise);
    const second = value.set('8h', () => b.promise);
    b.resolve();
    await second;
    a.reject(new Error('late'));
    await first;
    expect(value.current).toBe('8h');
    expect(value.failed).toBe(false);
  });

  test('falls back to the last value the host accepted, not an earlier guess', async () => {
    const { value } = setup('off');
    await value.set('on', () => Promise.resolve());
    const a = deferred(), b = deferred();
    const p1 = value.set('off', () => a.promise);
    const p2 = value.set('on', () => b.promise);
    a.reject(new Error('x'));
    b.reject(new Error('y'));
    await Promise.all([p1, p2]);
    expect(value.current).toBe('on');
  });

  test('both of two rejections end on the host value', async () => {
    const { value } = setup('false');
    const a = deferred(), b = deferred();
    const p1 = value.set('true', () => a.promise);
    const p2 = value.set('false', () => b.promise);
    a.reject(new Error('x'));
    b.reject(new Error('y'));
    await Promise.all([p1, p2]);
    expect(value.current).toBe('false');
    expect(value.failed).toBe(true);
  });

  test('an older success that lands after every newer call failed still lands', async () => {
    const { value } = setup('a');
    const a = deferred(), b = deferred();
    const p1 = value.set('b', () => a.promise);
    const p2 = value.set('c', () => b.promise);
    b.reject(new Error('x'));
    await p2;
    expect(value.current).toBe('a');
    a.resolve();
    await p1;
    expect(value.current).toBe('b');
  });

  test('sync follows a new host value once nothing is in flight', async () => {
    const { value, setHost } = setup('off');
    await value.set('on', () => Promise.resolve());
    setHost('off'); // e.g. changed on another device
    expect(value.current).toBe('off');
  });

  test('sync waits while a call is in flight', async () => {
    const { value, setHost } = setup('off');
    const d = deferred();
    const p = value.set('on', () => d.promise);
    setHost('other');
    expect(value.current).toBe('on');
    d.resolve();
    await p;
    await flush();
    expect(value.current).toBe('on');
  });
});
