import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Presence } from './presence.svelte';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Presence', () => {
  test('starts unmounted, and opening mounts it', () => {
    const p = new Presence(280);
    expect(p.mounted).toBe(false);
    p.set(true);
    expect([p.mounted, p.leaving]).toEqual([true, false]);
  });

  test('closing keeps it mounted while it leaves, then unmounts it', () => {
    const p = new Presence(280);
    p.set(true);
    p.set(false);
    expect([p.mounted, p.leaving]).toEqual([true, true]);
    vi.advanceTimersByTime(279);
    expect(p.mounted).toBe(true);
    vi.advanceTimersByTime(1);
    expect([p.mounted, p.leaving]).toEqual([false, false]);
  });

  test('opening again while it leaves takes it back, and the old unmount never lands', () => {
    const p = new Presence(280);
    p.set(true);
    p.set(false);
    vi.advanceTimersByTime(200);
    p.set(true);
    expect([p.mounted, p.leaving]).toEqual([true, false]);
    vi.advanceTimersByTime(500);
    expect(p.mounted).toBe(true);
  });

  test('closing twice, or closing what never opened, changes nothing', () => {
    const closed = new Presence(280);
    closed.set(false);
    expect([closed.mounted, closed.leaving]).toEqual([false, false]);

    const p = new Presence(280);
    p.set(true);
    p.set(false);
    vi.advanceTimersByTime(200);
    p.set(false);
    vi.advanceTimersByTime(80);
    expect(p.mounted).toBe(false);
  });

  test('dispose stops a pending unmount', () => {
    const p = new Presence(280);
    p.set(true);
    p.set(false);
    p.dispose();
    vi.advanceTimersByTime(1000);
    expect([p.mounted, p.leaving]).toEqual([true, true]);
  });
});
