import { describe, expect, test } from 'vitest';
import { CANCELLED } from './optimistic.svelte';
import { Waited } from './waited.svelte';

const deferred = () => {
  let resolve!: () => void, reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
};

function setup(initial: boolean) {
  let host = initial;
  const value = new Waited(() => host);
  return { value, setHost: (v: boolean) => ((host = v), value.sync()) };
}

describe('Waited', () => {
  test('keeps the value from before while the call is in flight, then shows the new one', async () => {
    const { value } = setup(false);
    const d = deferred();
    const done = value.set(true, () => d.promise);
    expect(value.pending).toBe(true);
    expect(value.current).toBe(false);
    d.resolve();
    expect(await done).toBe(true);
    expect(value.pending).toBe(false);
    expect(value.current).toBe(true);
    expect(value.failed).toBe(false);
  });

  test('a rejected call leaves the value from before and sets failed', async () => {
    const { value } = setup(false);
    expect(await value.set(true, () => Promise.reject(new Error('x')))).toBe(false);
    expect(value.current).toBe(false);
    expect(value.failed).toBe(true);
    expect(value.pending).toBe(false);
  });

  test('a call the host gave up (CANCELLED) leaves the value from before without failing', async () => {
    const { value } = setup(false);
    expect(await value.set(true, () => Promise.reject(CANCELLED))).toBe(false);
    expect(value.current).toBe(false);
    expect(value.failed).toBe(false);
  });

  test('a change while one is in flight is ignored', async () => {
    const { value } = setup(false);
    const d = deferred();
    const first = value.set(true, () => d.promise);
    let called = false;
    expect(
      await value.set(false, () => {
        called = true;
      }),
    ).toBe(false);
    expect(called).toBe(false);
    d.resolve();
    await first;
    expect(value.current).toBe(true);
  });

  test("a host updating its own value as the call starts doesn't show through until it settles", async () => {
    const { value, setHost } = setup(false);
    const d = deferred();
    const done = value.set(true, () => {
      setHost(true);
      return d.promise;
    });
    expect(value.current).toBe(false);
    d.resolve();
    await done;
    expect(value.current).toBe(true);
  });

  test('the host is followed again once nothing is in flight', async () => {
    const { value, setHost } = setup(false);
    await value.set(true, () => Promise.resolve());
    expect(value.current).toBe(true);
    setHost(false); // unfollowed elsewhere
    expect(value.current).toBe(false);
  });
});
