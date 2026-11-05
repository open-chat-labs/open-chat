import { describe, expect, test } from 'vitest';
import { anchoredPlacement, liftPlacement, menuHeight } from './menuPlacement';

const frame = { left: 0, top: 0, width: 400, height: 800 };

describe('menuHeight', () => {
  test('48px rows, 11px dividers and 6px padding either side', () => {
    expect(menuHeight([])).toBe(12);
    expect(menuHeight([{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C', separator: true, danger: true }])).toBe(3 * 48 + 11 + 12);
  });
});

describe('anchoredPlacement', () => {
  const kebab = { left: 348, top: 50, width: 44, height: 44 };

  test('under a header kebab: 4px below it, its end edge 4px inside the anchor, from the top corner', () => {
    expect(anchoredPlacement(kebab, frame, 200, false)).toEqual({ side: 'below', top: 98, inlineEnd: 12, maxHeight: 690, origin: 'top right' });
  });

  test('a value row near the bottom opens above it, from the bottom corner', () => {
    const row = { left: 16, top: 700, width: 368, height: 60 };
    expect(anchoredPlacement(row, frame, 200, false)).toEqual({ side: 'above', bottom: 104, inlineEnd: 20, maxHeight: 684, origin: 'bottom right' });
  });

  test('below as long as it fits there, even with more room above', () => {
    const row = { left: 16, top: 500, width: 368, height: 60 };
    expect(anchoredPlacement(row, frame, 200, false).side).toBe('below');
  });

  test('fitting neither way, it takes the roomier side and scrolls', () => {
    const short = { left: 0, top: 0, width: 400, height: 300 };
    const row = { left: 16, top: 100, width: 368, height: 60 };
    expect(anchoredPlacement(row, short, 400, false)).toMatchObject({ side: 'below', maxHeight: 124 });
    expect(anchoredPlacement({ ...row, top: 180 }, short, 400, false)).toMatchObject({ side: 'above', maxHeight: 164 });
  });

  test('in RTL the offsets run from the left, and it scales from the left corner', () => {
    const rtlKebab = { left: 8, top: 50, width: 44, height: 44 };
    expect(anchoredPlacement(rtlKebab, frame, 200, true)).toMatchObject({ side: 'below', inlineEnd: 12, origin: 'top left' });
  });

  test('positions are inside the frame, wherever it sits', () => {
    const inset = { left: 0, top: 54, width: 400, height: 712 };
    expect(anchoredPlacement({ ...kebab, top: 54 }, inset, 200, false)).toMatchObject({ side: 'below', top: 48 });
  });
});

describe('liftPlacement', () => {
  const row = { left: 6, top: 200, width: 388, height: 72 };

  test('a row lifts in place, and the menu opens 8px under it, 8px in from its start', () => {
    expect(liftPlacement(row, frame, 300, false)).toEqual({
      card: { top: 200, inlineStart: 6, width: 388 },
      menu: { top: 280, inlineStart: 14 },
      side: 'below',
      origin: 'top left',
    });
  });

  test('without 24px to spare under the menu, it opens 8px over the row', () => {
    const low = { ...row, top: 600 };
    expect(liftPlacement(low, frame, 300, false)).toMatchObject({ menu: { top: 292, inlineStart: 14 }, side: 'above', origin: 'bottom left' });
    // just enough room below: 800 - 472 - 24 = 304 > 300
    expect(liftPlacement({ ...row, top: 400 }, frame, 300, false).side).toBe('below');
    expect(liftPlacement({ ...row, top: 404 }, frame, 300, false).side).toBe('above');
  });

  test('over the row, the menu stays 12px from the top', () => {
    expect(liftPlacement({ ...row, top: 150 }, { ...frame, height: 400 }, 300, false).menu.top).toBe(12);
  });

  test('the menu keeps 12px from the frame end', () => {
    const wide = { left: 300, top: 200, width: 220, height: 60 };
    expect(liftPlacement(wide, frame, 300, false).menu.inlineStart).toBe(400 - 240 - 12);
  });

  test('a small target (a strip avatar) lifts as a 240px card, kept on screen, the menu under its 66px', () => {
    const avatar = { left: 10, top: 100, width: 42, height: 42 };
    expect(liftPlacement(avatar, frame, 300, false)).toMatchObject({ card: { top: 100, inlineStart: 12, width: 240 }, menu: { top: 174, inlineStart: 12 }, side: 'below' });
    const low = { left: 350, top: 760, width: 42, height: 42 };
    expect(liftPlacement(low, frame, 200, false)).toMatchObject({ card: { top: 722, inlineStart: 148, width: 240 }, menu: { top: 514, inlineStart: 148 }, side: 'above' });
  });

  test('in RTL it measures from the right and opens from the right corner', () => {
    const rtlRow = { left: 20, top: 200, width: 300, height: 72 };
    expect(liftPlacement(rtlRow, frame, 300, true)).toMatchObject({ card: { inlineStart: 80, width: 300 }, menu: { inlineStart: 88 }, origin: 'top right' });
  });
});
