import { describe, expect, test } from 'vitest';
import { deletedPopoverBelow, deletedPopoverOpen, hoversIn } from './deletedPopover';

describe('deletedPopoverOpen', () => {
  test('a rested hover and the keyboard focus open it', () => {
    expect(deletedPopoverOpen(false, { kind: 'hover' })).toBe(true);
    expect(deletedPopoverOpen(false, { kind: 'focus', keyboard: true })).toBe(true);
  });

  test("a click's focus leaves it as it was", () => {
    expect(deletedPopoverOpen(false, { kind: 'focus', keyboard: false })).toBe(false);
    expect(deletedPopoverOpen(true, { kind: 'focus', keyboard: false })).toBe(true);
  });

  test('leaving, blur, Esc and a press elsewhere close it', () => {
    for (const kind of ['leave', 'blur', 'escape', 'outside'] as const) {
      expect(deletedPopoverOpen(true, { kind })).toBe(false);
      expect(deletedPopoverOpen(false, { kind })).toBe(false);
    }
  });

  test('a tap opens it and a second tap closes it', () => {
    const tap = { kind: 'click', pointer: 'touch', heldMs: 80 } as const;
    expect(deletedPopoverOpen(false, tap)).toBe(true);
    expect(deletedPopoverOpen(true, tap)).toBe(false);
    expect(deletedPopoverOpen(true, { kind: 'click', pointer: 'pen', heldMs: 80 })).toBe(false);
  });

  test('Enter or Space toggles it', () => {
    const key = { kind: 'click', pointer: 'keyboard', heldMs: 0 } as const;
    expect(deletedPopoverOpen(false, key)).toBe(true);
    expect(deletedPopoverOpen(true, key)).toBe(false);
  });

  test("a mouse click opens it, and doesn't close what the hover opened", () => {
    const click = { kind: 'click', pointer: 'mouse', heldMs: 90 } as const;
    expect(deletedPopoverOpen(false, click)).toBe(true);
    expect(deletedPopoverOpen(true, click)).toBe(true);
  });

  test('a long-press (the message menu) changes nothing', () => {
    const press = { kind: 'click', pointer: 'touch', heldMs: 600 } as const;
    expect(deletedPopoverOpen(false, press)).toBe(false);
    expect(deletedPopoverOpen(true, press)).toBe(true);
  });
});

describe('deletedPopoverBelow', () => {
  test('above the placeholder where it fits, 8px clear of it', () => {
    expect(deletedPopoverBelow(200, 40, 0)).toBe(false);
    expect(deletedPopoverBelow(148, 40, 100)).toBe(false);
  });

  test("under it where it wouldn't fit above, inside the scroller", () => {
    expect(deletedPopoverBelow(147, 40, 100)).toBe(true);
    expect(deletedPopoverBelow(30, 40, 0)).toBe(true);
  });
});

describe('hoversIn', () => {
  test('a mouse, and a pen above the screen, hover in', () => {
    expect(hoversIn('mouse', 0)).toBe(true);
    expect(hoversIn('mouse', 1)).toBe(true);
    expect(hoversIn('pen', 0)).toBe(true);
  });

  test("a touch, and a pen that enters as it touches, are taps: their enter and leave don't count", () => {
    expect(hoversIn('touch', 0)).toBe(false);
    expect(hoversIn('touch', 1)).toBe(false);
    expect(hoversIn('pen', 1)).toBe(false);
  });
});
