import { describe, expect, test } from 'vitest';
import { BAR_GAP, BAR_H, BAR_W, barPlacement, overBubble } from './hoverBar';

const short = { left: 40, top: 10, width: 260, height: 44 };

describe('barPlacement', () => {
  test("over a wide bubble's end, above it", () => {
    expect(barPlacement({ left: 40, top: 0, width: 400, height: 80 }, 900, false, false)).toEqual({ left: 40 + 400 - BAR_W - 8 });
  });

  test("over a narrow bubble's start, above it", () => {
    expect(barPlacement({ left: 40, top: 0, width: 120, height: 44 }, 900, false, false)).toEqual({ left: 40 });
  });

  test("beside a deleted placeholder, at its end, centred on it: clear of the bubble and of a popover above or below it", () => {
    const p = barPlacement(short, 900, true, false);
    expect(p).toEqual({ left: 40 + 260 + BAR_GAP, top: 10 + (44 - BAR_H) / 2 });
    // inside the bubble's height: a popover 8px above or below it can't meet the bar
    expect(p.top!).toBeGreaterThanOrEqual(short.top);
    expect(p.top! + BAR_H).toBeLessThanOrEqual(short.top + short.height);
    // past its end: nothing of the bubble under it
    expect(p.left!).toBeGreaterThan(short.left + short.width);
  });

  test('beside a mirrored placeholder, at its start', () => {
    expect(barPlacement({ ...short, left: 600 }, 900, true, true)).toEqual({ right: 900 - 600 + BAR_GAP, top: 10 + (44 - BAR_H) / 2 });
  });
});

describe('overBubble', () => {
  test('the bubble keeps the bar showing', () => {
    expect(overBubble(40, short, false, false)).toBe(true);
    expect(overBubble(300, short, false, false)).toBe(true);
    expect(overBubble(301, short, false, false)).toBe(false);
  });

  test("the way to a bar beside the bubble does too, on the bar's side only", () => {
    expect(overBubble(300 + BAR_GAP, short, true, false)).toBe(true);
    expect(overBubble(300 + BAR_GAP + BAR_W, short, true, false)).toBe(true);
    expect(overBubble(39, short, true, false)).toBe(false);
    const right = { ...short, left: 600 };
    expect(overBubble(600 - BAR_GAP, right, true, true)).toBe(true);
    expect(overBubble(861, right, true, true)).toBe(false);
  });
});
