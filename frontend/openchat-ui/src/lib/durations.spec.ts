import { describe, expect, test } from 'vitest';
import { DISAPPEARING_DURATIONS, durationColumns, durationMs } from './durations';

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

describe('DISAPPEARING_DURATIONS', () => {
  // native plan 10 / web plan 08, 2026-11-10: 5 min to 30 days, 4 × 2
  test('are the 8 lengths the design offers', () => {
    expect(DISAPPEARING_DURATIONS).toEqual(['5 minutes', '15 minutes', '1 hour', '8 hours', '12 hours', '1 day', '1 week', '30 days']);
  });
});

describe('durationColumns', () => {
  test('is 4 when the count divides by 4, else 3', () => {
    expect(durationColumns(8)).toBe(4);
    expect(durationColumns(4)).toBe(4);
    expect(durationColumns(12)).toBe(4);
    expect(durationColumns(6)).toBe(3);
    expect(durationColumns(9)).toBe(3);
    expect(durationColumns(7)).toBe(3);
    expect(durationColumns(0)).toBe(3);
  });

  test('takes the columns the host gives over the rule', () => {
    expect(durationColumns(8, 2)).toBe(2);
    expect(durationColumns(6, 4)).toBe(4);
  });

  test('ignores columns that are not a positive whole number', () => {
    expect(durationColumns(8, 0)).toBe(4);
    expect(durationColumns(6, -1)).toBe(3);
    expect(durationColumns(6, 2.5)).toBe(3);
  });
});
