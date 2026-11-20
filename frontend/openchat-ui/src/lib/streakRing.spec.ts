import { describe, expect, test } from 'vitest';
import { claimMadeToday, milestoneReachedToday, ringFill, streakRingProgress } from './streakRing';

const TIERS = [3, 7, 14, 30, 100, 365];

describe('streakRingProgress', () => {
  test('empty with no streak, by thirds towards 3, full on the day 3 is reached', () => {
    expect(streakRingProgress(0, true, TIERS)).toBe(0);
    expect(streakRingProgress(1, true, TIERS)).toBeCloseTo(1 / 3);
    expect(streakRingProgress(2, false, TIERS)).toBeCloseTo(2 / 3);
    expect(streakRingProgress(3, true, TIERS)).toBe(1);
  });

  test('on a milestone with the next claim open, the next segment starts empty, so a claim moves the ring forward', () => {
    expect(streakRingProgress(3, false, TIERS)).toBe(0);
    expect(streakRingProgress(4, true, TIERS)).toBe(1 / 4);
    expect(streakRingProgress(8, false, TIERS)).toBe(1 / 7);
  });

  test('full from the last milestone on; empty with no milestones', () => {
    expect(streakRingProgress(365, false, TIERS)).toBe(1);
    expect(streakRingProgress(1000, true, TIERS)).toBe(1);
    expect(streakRingProgress(5, true, [])).toBe(0);
  });
});

describe('ringFill', () => {
  test("the host's progress, clamped", () => {
    expect(ringFill(0.25, () => 0.5)).toBe(0.25);
    expect(ringFill(-1, () => 0.5)).toBe(0);
    expect(ringFill(2, () => 0.5)).toBe(1);
  });

  test('the default rule without a progress, or with one that is not a finite number', () => {
    expect(ringFill(undefined, () => 0.5)).toBe(0.5);
    expect(ringFill(NaN, () => 0.5)).toBe(0.5);
    expect(ringFill(Infinity, () => 0.5)).toBe(0.5);
  });
});

describe('milestoneReachedToday', () => {
  test('the milestone while it is claimed today, short of the last one', () => {
    expect(milestoneReachedToday(3, true, TIERS)).toBe(3);
    expect(milestoneReachedToday(3, false, TIERS)).toBeUndefined();
    expect(milestoneReachedToday(4, true, TIERS)).toBeUndefined();
    expect(milestoneReachedToday(365, true, TIERS)).toBeUndefined();
  });
});

describe('claimMadeToday', () => {
  test("the host's claimedToday when it passes one: with CHIT off nothing is claimable, made or not", () => {
    expect(claimMadeToday(null, false, false)).toBe(false);
    expect(claimMadeToday(null, true, false)).toBe(true);
  });

  test('without it, not claimable means made', () => {
    expect(claimMadeToday(null, undefined, false)).toBe(true);
    expect(claimMadeToday(null, undefined, true)).toBe(false);
  });

  test('a claim made in the dialog counts before the host has caught up', () => {
    expect(claimMadeToday(true, false, true)).toBe(true);
  });
});
