import { describe, expect, test } from 'vitest';
import { DISAPPEARING_DURATIONS, durationMs } from './durations';

describe('durationMs', () => {
  test('reads a duration id in milliseconds, singular or plural', () => {
    expect(durationMs('1 hour')).toBe(3_600_000);
    expect(durationMs('8 hours')).toBe(8 * 3_600_000);
    expect(durationMs('1 week')).toBe(7 * 86_400_000);
    expect(durationMs('90 minutes')).toBe(90 * 60_000);
    expect(durationMs('1 month')).toBe(30 * 86_400_000);
  });

  test('is 0 for a value that is not a duration', () => {
    expect(durationMs('Always')).toBe(0);
    expect(durationMs('')).toBe(0);
  });

  test('reads every disappearing-messages length, shortest first', () => {
    const lengths = DISAPPEARING_DURATIONS.map(durationMs);
    expect(lengths.every((ms) => ms > 0)).toBe(true);
    expect([...lengths].sort((a, b) => a - b)).toEqual(lengths);
  });
});
