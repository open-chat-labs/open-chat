import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { DialogFlow } from './dialog.svelte';

const deferred = <T = void>() => {
  let resolve!: (v: T) => void, reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
};

describe('DialogFlow', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test('a second run while the first is pending is ignored', async () => {
    const flow = new DialogFlow();
    const d = deferred<string>();
    const call = vi.fn(() => d.promise);
    const first = flow.run(call);
    expect(await flow.run(call)).toEqual({ ok: false });
    expect(call).toHaveBeenCalledOnce();
    d.resolve('done');
    expect(await first).toEqual({ ok: true, value: 'done' });
    expect(flow.busy).toBe(false);
  });

  test('a rejection sets failed and frees the dialog for a retry', async () => {
    const flow = new DialogFlow();
    expect(await flow.run(() => Promise.reject(new Error('no')))).toEqual({ ok: false });
    expect(flow.failed).toBe(true);
    expect(flow.locked).toBe(false);
    expect(await flow.run(() => 1)).toEqual({ ok: true, value: 1 });
    expect(flow.failed).toBe(false);
  });

  test('dismiss is ignored while a call is pending', async () => {
    const flow = new DialogFlow();
    const d = deferred();
    const onCancel = vi.fn();
    const pending = flow.run(() => d.promise);
    flow.dismiss(onCancel);
    flow.escape(onCancel)?.();
    vi.runAllTimers();
    expect(flow.closing).toBe(false);
    expect(onCancel).not.toHaveBeenCalled();
    d.resolve();
    await pending;
    flow.dismiss(onCancel);
    vi.runAllTimers();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  test('leave stays out, runs then once after the exit, and blocks everything after', async () => {
    const flow = new DialogFlow({ exitMs: 170 });
    const then = vi.fn();
    flow.leave(then);
    flow.leave(then);
    flow.dismiss(then);
    expect(flow.escape(then)).toBeUndefined();
    vi.advanceTimersByTime(169);
    expect(then).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(then).toHaveBeenCalledOnce();
    vi.runAllTimers();
    expect(flow.closing).toBe(true);
    const call = vi.fn();
    expect(await flow.run(call)).toEqual({ ok: false });
    expect(call).not.toHaveBeenCalled();
  });

  test('destroy cancels a pending exit callback', () => {
    const flow = new DialogFlow();
    const then = vi.fn();
    flow.leave(then);
    flow.destroy();
    vi.runAllTimers();
    expect(then).not.toHaveBeenCalled();
  });

  test('a call that resolves after destroy never calls back', async () => {
    const flow = new DialogFlow();
    const d = deferred();
    const onCancel = vi.fn();
    const pending = flow.run(() => d.promise).then((r) => r.ok && flow.leave(onCancel));
    flow.destroy();
    d.resolve();
    await pending;
    vi.runAllTimers();
    expect(onCancel).not.toHaveBeenCalled();
  });
});
