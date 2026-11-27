import { describe, expect, test } from 'vitest';
import { BAR_HEIGHT, BAR_INSET, barJumps, barPlacement } from './railBar';

// the list shows from 220 to 514 (rail px)
const LIST = { top: 220, bottom: 514 };

describe('barPlacement', () => {
  test('a row outside the list (an item, the foot) gets the bar at its inset, whole', () => {
    expect(barPlacement(18, null)).toEqual({ top: 18 + BAR_INSET, clip: null, hidden: false });
    // even far down: only the list's pins can be scrolled away
    expect(barPlacement(1200, null)).toEqual({ top: 1200 + BAR_INSET, clip: null, hidden: false });
  });

  test('a pin in view gets the bar whole', () => {
    expect(barPlacement(300, LIST)).toEqual({ top: 307, clip: null, hidden: false });
  });

  test('rounds the row position', () => {
    expect(barPlacement(300.4, LIST).top).toBe(307);
    expect(barPlacement(300.6, LIST).top).toBe(308);
  });

  test('a pin partly past the bottom edge has the bar cut there', () => {
    // bar 498..526, list ends at 514
    expect(barPlacement(491, LIST)).toEqual({ top: 498, clip: { top: 0, bottom: 12 }, hidden: false });
  });

  test('a pin partly past the top edge has the bar cut there', () => {
    // bar 210..238, list starts at 220
    expect(barPlacement(203, LIST)).toEqual({ top: 210, clip: { top: 10, bottom: 0 }, hidden: false });
  });

  test('a pin scrolled wholly out below hides the bar, parked at the list foot, inside the rail', () => {
    const placed = barPlacement(1200, LIST);
    expect(placed).toEqual({ top: LIST.bottom - BAR_HEIGHT, clip: null, hidden: true });
    expect(placed.top + BAR_HEIGHT).toBeLessThanOrEqual(LIST.bottom);
  });

  test('a pin scrolled wholly out above hides the bar, parked at the list top', () => {
    expect(barPlacement(-400, LIST)).toEqual({ top: LIST.top, clip: null, hidden: true });
  });

  test('just touching an edge counts as out', () => {
    // bar 514..542: none of it shows
    expect(barPlacement(507, LIST).hidden).toBe(true);
    // bar 192..220
    expect(barPlacement(185, LIST).hidden).toBe(true);
  });

  test('a list shorter than the bar parks it at its top', () => {
    expect(barPlacement(900, { top: 220, bottom: 240 })).toEqual({ top: 220, clip: null, hidden: true });
  });
});

describe('barJumps', () => {
  test('from a whole bar, or none yet, it slides', () => {
    expect(barJumps(null)).toBe(false);
    expect(barJumps({ clip: null, hidden: false })).toBe(false);
  });

  test('from a bar cut off in part, or hidden, it jumps', () => {
    expect(barJumps({ clip: { top: 0, bottom: 12 }, hidden: false })).toBe(true);
    expect(barJumps({ clip: null, hidden: true })).toBe(true);
  });
});
