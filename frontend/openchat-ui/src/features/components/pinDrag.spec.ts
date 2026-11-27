import { describe, expect, test } from 'vitest';
import { autoScrollStep, dragStarted, dropIndex, moveItem, SCROLL_EDGE, SCROLL_MAX, shiftFor } from './pinDrag';

// five rows 42px tall, 14px apart: centres 21, 77, 133, 189, 245
const PITCH = 56;
const MIDS = [21, 77, 133, 189, 245];

describe('dragStarted', () => {
  test('a press becomes a drag once it has moved 5px either way', () => {
    expect(dragStarted(0)).toBe(false);
    expect(dragStarted(4)).toBe(false);
    expect(dragStarted(-4.9)).toBe(false);
    expect(dragStarted(5)).toBe(true);
    expect(dragStarted(-12)).toBe(true);
  });
});

describe('dropIndex', () => {
  test('a row that has not passed a neighbour keeps its place', () => {
    expect(dropIndex(2, 133, MIDS)).toBe(2);
    expect(dropIndex(2, 133 + 50, MIDS)).toBe(2);
    expect(dropIndex(2, 133 - 50, MIDS)).toBe(2);
  });

  test('passing the next row centre moves it one down, and the previous one up', () => {
    expect(dropIndex(2, 190, MIDS)).toBe(3);
    expect(dropIndex(2, 76, MIDS)).toBe(1);
  });

  test('past the ends it lands first or last', () => {
    expect(dropIndex(2, -500, MIDS)).toBe(0);
    expect(dropIndex(2, 5000, MIDS)).toBe(4);
    expect(dropIndex(0, 5000, MIDS)).toBe(4);
    expect(dropIndex(4, -500, MIDS)).toBe(0);
  });

  test('the first and last rows move across several', () => {
    expect(dropIndex(0, 200, MIDS)).toBe(3);
    expect(dropIndex(4, 100, MIDS)).toBe(2);
  });

  test('a list of one stays put', () => {
    expect(dropIndex(0, 999, [21])).toBe(0);
  });
});

describe('shiftFor', () => {
  test('dragged down: the rows it passed move up a row', () => {
    expect([0, 1, 2, 3, 4].map((i) => shiftFor(i, 1, 3, PITCH))).toEqual([0, 0, -PITCH, -PITCH, 0]);
  });

  test('dragged up: the rows it passed move down a row', () => {
    expect([0, 1, 2, 3, 4].map((i) => shiftFor(i, 3, 1, PITCH))).toEqual([0, PITCH, PITCH, 0, 0]);
  });

  test('held over its own place: nothing moves', () => {
    expect([0, 1, 2, 3, 4].map((i) => shiftFor(i, 2, 2, PITCH))).toEqual([0, 0, 0, 0, 0]);
  });
});

describe('moveItem', () => {
  test('moves an item down or up', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  test('to its own place, or out of range, it is a copy of the list as it was', () => {
    const list = ['a', 'b', 'c'];
    const same = moveItem(list, 1, 1);
    expect(same).toEqual(list);
    expect(same).not.toBe(list);
    expect(moveItem(list, -1, 1)).toEqual(list);
    expect(moveItem(list, 0, 3)).toEqual(list);
  });
});

describe('autoScrollStep', () => {
  const top = 200;
  const bottom = 500;

  test('away from the edges the list stays still', () => {
    expect(autoScrollStep(350, top, bottom)).toBe(0);
    expect(autoScrollStep(top + SCROLL_EDGE, top, bottom)).toBe(0);
    expect(autoScrollStep(bottom - SCROLL_EDGE, top, bottom)).toBe(0);
  });

  test('near the top it scrolls up, faster the closer to the edge', () => {
    const near = autoScrollStep(top + SCROLL_EDGE - 6, top, bottom);
    const closer = autoScrollStep(top + 4, top, bottom);
    expect(near).toBeLessThan(0);
    expect(closer).toBeLessThan(near);
  });

  test('near the bottom it scrolls down', () => {
    expect(autoScrollStep(bottom - 10, top, bottom)).toBeGreaterThan(0);
  });

  test('at or past an edge it scrolls at its fastest', () => {
    expect(autoScrollStep(top, top, bottom)).toBe(-SCROLL_MAX);
    expect(autoScrollStep(top - 80, top, bottom)).toBe(-SCROLL_MAX);
    expect(autoScrollStep(bottom + 80, top, bottom)).toBe(SCROLL_MAX);
  });
});
