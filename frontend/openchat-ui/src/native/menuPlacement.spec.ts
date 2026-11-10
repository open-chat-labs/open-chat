import { describe, expect, test } from 'vitest';
import { anchoredPlacement, liftPlacement, menuHeight, messageMenuPlacement } from './menuPlacement';

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
      menu: { top: 280, inlineStart: 14, maxHeight: 508 },
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

  test('fitting neither side, it takes the roomier one and scrolls, never covering the row', () => {
    // 647px frame, a 72px row at 280, six rows (311px): 271px to spare below isn't enough, nor 260px above
    const tall = { ...frame, height: 647 };
    const mid = { ...row, top: 280 };
    expect(liftPlacement(mid, tall, 311, false)).toMatchObject({ side: 'below', menu: { top: 360, maxHeight: 275 } });
    // higher on the screen, more room below than above: below, scrolling
    expect(liftPlacement({ ...row, top: 150 }, { ...frame, height: 400 }, 300, false)).toMatchObject({ side: 'below', menu: { top: 230, maxHeight: 158 } });
    // lower, more room above: from 12px down to 8px over the row
    const low = liftPlacement({ ...row, top: 250 }, { ...frame, height: 400 }, 300, false);
    expect(low).toMatchObject({ side: 'above', menu: { top: 12, maxHeight: 230 } });
    expect(low.menu.top + low.menu.maxHeight).toBe(250 - 8);
  });

  test('a menu that fits keeps its full height as the limit', () => {
    expect(liftPlacement({ ...row, top: 600 }, frame, 300, false).menu).toMatchObject({ top: 292, maxHeight: 580 });
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

describe('messageMenuPlacement', () => {
  // a 390 × 800 screen; the bar 300 × 52, the card 240 × 300
  const screen = { left: 0, top: 0, width: 390, height: 800 };
  const bar = { width: 300, height: 52 };
  const card = { width: 240, height: 300 };
  // a received bubble from 12px, a sent one ending 12px from the right
  const received = { left: 12, top: 300, width: 200, height: 60 };
  const sent = { left: 178, top: 300, width: 200, height: 60 };

  test('first choice: the reactions above and the card below, lined up with the bubble start (received)', () => {
    expect(messageMenuPlacement(received, screen, bar, card, 'received', false)).toEqual({
      order: 'bar-above',
      bar: { top: 240, inlineStart: 12, origin: 'bottom left' },
      menu: { top: 368, inlineStart: 12, maxHeight: 300, origin: 'top left' },
    });
  });

  test("a sent message's line up with its bubble's end edge", () => {
    expect(messageMenuPlacement(sent, screen, bar, card, 'sent', false)).toMatchObject({
      bar: { inlineStart: 378 - 300, origin: 'bottom right' },
      menu: { inlineStart: 378 - 240, origin: 'top right' },
    });
  });

  test('kept 12px inside the screen', () => {
    const narrow = { ...sent, left: 330, width: 50 };
    expect(messageMenuPlacement(narrow, screen, bar, card, 'received', false).bar?.inlineStart).toBe(390 - 300 - 12);
    expect(messageMenuPlacement({ ...received, left: 2 }, screen, bar, card, 'sent', false).menu.inlineStart).toBe(12);
  });

  test('low on the screen: the card above and the reactions below', () => {
    const low = { ...received, top: 660 };
    expect(messageMenuPlacement(low, screen, bar, card, 'received', false)).toMatchObject({
      order: 'menu-above',
      bar: { top: 728, origin: 'top left' },
      menu: { top: 352, origin: 'bottom left' },
    });
  });

  test('then both above, the reactions on top; then both below, the reactions first', () => {
    const lowest = { ...received, top: 700, height: 88 };
    expect(messageMenuPlacement(lowest, screen, bar, card, 'received', false)).toMatchObject({ order: 'above', bar: { top: 332 }, menu: { top: 392 } });
    const highest = { ...received, top: 20, height: 60 };
    expect(messageMenuPlacement(highest, screen, bar, card, 'received', false)).toMatchObject({ order: 'below', bar: { top: 88 }, menu: { top: 148 } });
  });

  test('a card too long to be whole anywhere scrolls on the roomier side, the reactions across the message', () => {
    // with the reactions, more than the screen less its edges (800 - 24)
    const long = { width: 240, height: 720 };
    expect(messageMenuPlacement(received, screen, bar, long, 'received', false)).toMatchObject({
      order: 'scroll',
      bar: { top: 240 },
      menu: { top: 368, maxHeight: 800 - 12 - 360 - 8 },
    });
    const lowMessage = { ...received, top: 500 };
    const up = messageMenuPlacement(lowMessage, screen, bar, long, 'received', false);
    expect(up).toMatchObject({ order: 'scroll', bar: { top: 568 }, menu: { maxHeight: 500 - 12 - 8 } });
    expect(up.menu.top).toBe(12);
  });

  test('a card that fits nowhere beside the message but fits the screen goes whole over it rather than scroll', () => {
    const long = { width: 240, height: 700 };
    expect(messageMenuPlacement(received, screen, bar, long, 'received', false)).toEqual({
      order: 'over',
      bar: { top: 12, inlineStart: 12, origin: 'top left' },
      menu: { top: 800 - 12 - 700, inlineStart: 12, maxHeight: 700, origin: 'bottom left' },
    });
    // a tall message with room for the reactions above it: they stay next to it, the card at the screen's bottom
    const tall = { ...received, top: 100, height: 650 };
    expect(messageMenuPlacement(tall, screen, bar, card, 'received', false)).toMatchObject({
      order: 'over',
      bar: { top: 100 - 60, origin: 'bottom left' },
      menu: { top: 800 - 12 - 300, maxHeight: 300 },
    });
  });

  test('a message filling the screen: the reactions at its top, the whole card at its bottom, over the message', () => {
    const tall = { ...received, top: 40, height: 700 };
    expect(messageMenuPlacement(tall, screen, bar, card, 'received', false)).toEqual({
      order: 'over',
      bar: { top: 12, inlineStart: 12, origin: 'top left' },
      menu: { top: 800 - 12 - 300, inlineStart: 12, maxHeight: 300, origin: 'bottom left' },
    });
  });

  test('a card taller than the screen scrolls at its bottom, under the reactions', () => {
    const tall = { ...received, top: 40, height: 700 };
    const huge = { width: 240, height: 900 };
    expect(messageMenuPlacement(tall, screen, bar, huge, 'received', false)).toMatchObject({
      order: 'over',
      bar: { top: 12 },
      menu: { top: 12 + 60, maxHeight: 800 - 24 - 60 },
    });
  });

  test("just above the composer (under the veil, so room): the card above, the reactions below, over it", () => {
    // the Android app's: a 866px frame inside 24px safe areas, which keep the edge themselves; the bar 356 × 56
    const phone = { left: 0, top: 24, width: 411, height: 866 };
    const androidBar = { width: 356, height: 56 };
    const sevenRows = { width: 240, height: 7 * 48 + 11 + 12 };
    const lastMessage = { left: 72, top: 479.6, width: 319.4, height: 344.6 };
    const edges = { top: 0, bottom: 0 };
    expect(messageMenuPlacement(lastMessage, phone, androidBar, sevenRows, 'sent', false, edges)).toMatchObject({
      order: 'menu-above',
      bar: { top: 479.6 - 24 + 344.6 + 8 },
      menu: { top: 479.6 - 24 - 359 - 8 },
    });
    // with 12px kept at the bottom besides, the reactions wouldn't fit under it
    expect(messageMenuPlacement(lastMessage, phone, androidBar, sevenRows, 'sent', false).order).toBe('above');
  });

  test('a card that fits exactly is whole, not a pixel short', () => {
    const exact = { ...received, top: 100 };
    const fits = { width: 240, height: 800 - 12 - 160 - 8 };
    expect(messageMenuPlacement(exact, screen, bar, fits, 'received', false)).toMatchObject({
      order: 'bar-above',
      menu: { top: 168, maxHeight: fits.height },
    });
  });

  test('without reactions only the card is placed', () => {
    expect(messageMenuPlacement(received, screen, null, card, 'received', false)).toMatchObject({ order: 'bar-above', bar: null, menu: { top: 368 } });
  });

  test('in RTL a received bubble starts on the right', () => {
    const rtlReceived = { left: 178, top: 300, width: 200, height: 60 };
    expect(messageMenuPlacement(rtlReceived, screen, bar, card, 'received', true)).toMatchObject({
      bar: { inlineStart: 12, origin: 'bottom right' },
      menu: { inlineStart: 12, origin: 'top right' },
    });
  });
});
