// Where the native menus open (native design notes §1 Sheets, menus): the anchored menu under (or, near the bottom,
// over) the button or row that opened it, from its corner; the long-press menu under (or over) the lifted row. Pure:
// AnchoredMenu and LongPressMenu measure, this decides. Positions are px inside the layer the menus are drawn in (the
// native root), with the safe areas already taken off the frame. Horizontal offsets are along the reading direction
// (inset-inline-start / -end), so RTL mirrors them.
import type { NativeMenuItem } from './types';

/** A menu row's height, the notes' 48px. */
export const MENU_ROW = 48;
/** A divider row: 1px and 5px either side. */
export const MENU_RULE = 11;
/** The menu card's padding, either side. */
export const MENU_PAD = 6;
/** The long-press menu's width. */
export const LIFT_MENU_WIDTH = 240;
/** A row narrower than this (a community strip's avatar) lifts as a LIFT_MENU_WIDTH card, SMALL_CARD_HEIGHT tall. */
export const SMALL_TARGET = 200;
export const SMALL_CARD_HEIGHT = 66;
/** Kept between a menu and the frame's edges. */
export const EDGE = 12;
/** The long-press menu goes below the row only with this much to spare under it. */
export const BELOW_SPARE = 24;

/** A box in the layer's px (as getBoundingClientRect gives it). */
export type Rect = { left: number; top: number; width: number; height: number };

export type AnchoredPlacement =
  | { side: 'below'; top: number; inlineEnd: number; maxHeight: number; origin: string }
  | { side: 'above'; bottom: number; inlineEnd: number; maxHeight: number; origin: string };

export type LiftPlacement = {
  /** The lifted copy of the row. */
  card: { top: number; inlineStart: number; width: number };
  /** The menu scrolls past maxHeight. */
  menu: { top: number; inlineStart: number; maxHeight: number };
  side: 'below' | 'above';
  /** transform-origin of the menu: the corner nearest the row. */
  origin: string;
};

/** The menu card's height for these items: the rows, their dividers and the padding. */
export function menuHeight(items: NativeMenuItem[]): number {
  return items.length * MENU_ROW + items.filter((i) => i.separator).length * MENU_RULE + 2 * MENU_PAD;
}

/** The anchored menu: its inline-end edge 4px inside the anchor's, 4px under it, or over it when it doesn't fit below
 *  and there's more room above; it scrolls past `maxHeight`. It scales from the corner nearest the anchor. */
export function anchoredPlacement(anchor: Rect, frame: Rect, height: number, rtl: boolean, gap = 4): AnchoredPlacement {
  const inlineEnd = Math.max(0, rtl ? anchor.left - frame.left + gap : frame.left + frame.width - (anchor.left + anchor.width) + gap);
  const below = frame.top + frame.height - (anchor.top + anchor.height) - gap - EDGE;
  const above = anchor.top - frame.top - gap - EDGE;
  const corner = rtl ? 'left' : 'right';
  if (below >= height || below >= above) {
    return { side: 'below', top: anchor.top + anchor.height - frame.top + gap, inlineEnd, maxHeight: Math.max(0, below), origin: `top ${corner}` };
  }
  return { side: 'above', bottom: frame.top + frame.height - anchor.top + gap, inlineEnd, maxHeight: Math.max(0, above), origin: `bottom ${corner}` };
}

/** The long-press menu: the row lifts where it is (a small target as a wider card, kept on screen), and the menu opens
 *  8px under it, 8px in from its start, when there's room (BELOW_SPARE to spare), else 8px over it if it fits there;
 *  fitting neither, it takes the roomier side and scrolls past `maxHeight`, never covering the row. */
export function liftPlacement(row: Rect, frame: Rect, height: number, rtl: boolean): LiftPlacement {
  const start = rtl ? frame.left + frame.width - (row.left + row.width) : row.left - frame.left;
  const top = row.top - frame.top;
  const small = row.width < SMALL_TARGET;

  const width = small ? LIFT_MENU_WIDTH : row.width;
  const cardHeight = small ? SMALL_CARD_HEIGHT : row.height;
  // over the row, a small target's card moves up to stay on screen
  const cardTopAbove = small ? Math.min(top, frame.height - cardHeight - EDGE) : top;
  const roomBelow = frame.height - (top + cardHeight + 8) - EDGE;
  const roomAbove = cardTopAbove - 8 - EDGE;
  const fitsBelow = frame.height - (top + row.height) - BELOW_SPARE > height;
  const below = fitsBelow || (roomAbove < height && roomBelow > roomAbove);

  const cardStart = small ? clamp(start, EDGE, frame.width - width - EDGE) : start;
  const cardTop = below ? top : cardTopAbove;
  const menuStart = small ? cardStart : clamp(start + 8, EDGE, frame.width - LIFT_MENU_WIDTH - EDGE);
  const menuTop = below ? cardTop + cardHeight + 8 : Math.max(EDGE, cardTop - height - 8);
  const corner = rtl ? 'right' : 'left';
  return {
    card: { top: cardTop, inlineStart: cardStart, width },
    menu: { top: menuTop, inlineStart: menuStart, maxHeight: Math.max(0, below ? roomBelow : roomAbove) },
    side: below ? 'below' : 'above',
    origin: `${below ? 'top' : 'bottom'} ${corner}`,
  };
}

function clamp(x: number, min: number, max: number): number {
  return Math.max(min, Math.min(x, max));
}
