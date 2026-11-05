import { describe, expect, test } from 'vitest';
import { releaseVelocity, sheetOffset, sheetRelease, veilOpacity, type DragSample } from './sheetDrag';

describe('sheetOffset', () => {
  test('follows the finger down', () => {
    expect(sheetOffset(0)).toBe(0);
    expect(sheetOffset(130)).toBe(130);
  });

  test('pulled up, rubber-bands at a quarter of the pull, 24px at most', () => {
    expect(sheetOffset(-40)).toBe(-10);
    expect(sheetOffset(-96)).toBe(-24);
    expect(sheetOffset(-400)).toBe(-24);
  });
});

describe('releaseVelocity', () => {
  const samples = (...points: [number, number][]): DragSample[] => points.map(([t, y]) => ({ t, y }));

  test('is px/ms over the last 100ms, down positive', () => {
    expect(releaseVelocity(samples([0, 0], [50, 40], [100, 80]), 100)).toBe(0.8);
    expect(releaseVelocity(samples([0, 100], [100, 40]), 100)).toBe(-0.6);
  });

  test('a hold before letting go reads as no flick: only the last 100ms count', () => {
    expect(releaseVelocity(samples([0, 0], [40, 200], [300, 200], [380, 200]), 400)).toBe(0);
  });

  test('is 0 with fewer than two recent samples', () => {
    expect(releaseVelocity([], 100)).toBe(0);
    expect(releaseVelocity(samples([0, 0], [10, 300]), 500)).toBe(0);
    expect(releaseVelocity(samples([0, 0], [490, 30]), 500)).toBe(0);
  });

  test('two samples in the same ms count as one ms apart', () => {
    expect(releaseVelocity(samples([100, 0], [100, 3]), 100)).toBe(3);
  });
});

describe('sheetRelease', () => {
  test('past 30% of the height closes, however slowly', () => {
    expect(sheetRelease(121, 400, 0)).toBe('close');
    expect(sheetRelease(120, 400, 0)).toBe('settle');
  });

  test('a downward flick closes from a short drag', () => {
    expect(sheetRelease(40, 400, 0.6)).toBe('close');
    expect(sheetRelease(40, 400, 0.5)).toBe('settle');
  });

  test("a flick needs more than 12px of drag, so a tap's jitter isn't one", () => {
    expect(sheetRelease(12, 400, 2)).toBe('settle');
    expect(sheetRelease(13, 400, 2)).toBe('close');
  });

  test('an upward pull or flick springs back', () => {
    expect(sheetRelease(-60, 400, -1)).toBe('settle');
    expect(sheetRelease(30, 400, -1)).toBe('settle');
  });
});

describe('veilOpacity', () => {
  test('is full at rest and when pulled up', () => {
    expect(veilOpacity(0)).toBe(1);
    expect(veilOpacity(-24)).toBe(1);
  });

  test('lightens as the sheet goes down, never under 0.35', () => {
    expect(veilOpacity(100)).toBe(0.8);
    expect(veilOpacity(325)).toBe(0.35);
    expect(veilOpacity(900)).toBe(0.35);
  });
});
