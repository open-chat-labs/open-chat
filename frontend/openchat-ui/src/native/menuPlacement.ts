// Where the native menus open (native design notes §1 Sheets, menus): the anchored menu under (or, near the bottom,
// over) the button or row that opened it, from its corner; the long-press menu under (or over) the lifted row; a
// message's long-press menu (§3.3) its reactions bar and action card round the message. Pure: AnchoredMenu,
// LongPressMenu and MessageLongPressMenu measure, this decides. Positions are px inside the layer the menus are drawn in (the
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

/** Between a message and its reactions bar or action card, and between the two. */
export const MESSAGE_MENU_GAP = 8;
/** The fewest of the action card's rows worth showing beside the message: with less room than this (and than the
 *  whole card) it goes to the bottom of the screen, over the message, rather than scroll in a sliver. */
export const MESSAGE_MENU_MIN = 3 * MENU_ROW + 2 * MENU_PAD;

export type MessageMenuOrder =
  /** The reactions above the message and the card below it: the first choice. */
  | 'bar-above'
  /** The card above and the reactions below. */
  | 'menu-above'
  /** Both above, the reactions on top. */
  | 'above'
  /** Both below, the reactions first. */
  | 'below'
  /** None of those fits (a tall message, a long card): the card scrolls on the roomier side. */
  | 'scroll'
  /** Not even that: the reactions at the top of the screen and the card at its bottom, over the message. */
  | 'over';

export type MessageMenuPlacement = {
  order: MessageMenuOrder;
  /** The reactions bar; none without one. */
  bar: { top: number; inlineStart: number; origin: string } | null;
  /** The action card, which scrolls past maxHeight. */
  menu: { top: number; inlineStart: number; maxHeight: number; origin: string };
};

/**
 * A message's long-press menu (native design notes §3.3): the message stays where it is, and its reactions bar and
 * action card line up with its bubble's start edge (received) or end edge (sent), kept 12px inside the screen's
 * edges. They go the first of these ways that fits: reactions above and the card below, the card above and the
 * reactions below, both above, both below. When none does, the card takes the roomier side and scrolls, with the
 * reactions on the other side if they fit there (else between it and the message); with too little room even for
 * that, the reactions sit at the top of the screen and the card at its bottom, over the message. `message` is the
 * message's box: its row's top and height, its bubble's left and width.
 */
export function messageMenuPlacement(
  message: Rect,
  frame: Rect,
  bar: { width: number; height: number } | null,
  menu: { width: number; height: number },
  side: 'received' | 'sent',
  rtl: boolean,
): MessageMenuPlacement {
  const gap = MESSAGE_MENU_GAP;
  const start = rtl ? frame.left + frame.width - (message.left + message.width) : message.left - frame.left;
  const inline = (width: number) => clamp(side === 'received' ? start : start + message.width - width, EDGE, frame.width - width - EDGE);
  // the corner nearest the message's edge they line up with
  const corner = (side === 'received') !== rtl ? 'left' : 'right';

  const top = message.top - frame.top;
  const bottom = top + message.height;
  const above = top - EDGE;
  const below = frame.height - EDGE - bottom;
  const barNeed = bar ? bar.height + gap : 0;
  const menuNeed = menu.height + gap;

  const place = (order: MessageMenuOrder, barTop: number, barUp: boolean, menuTop: number, menuUp: boolean, maxHeight: number): MessageMenuPlacement => ({
    order,
    bar: bar ? { top: barTop, inlineStart: inline(bar.width), origin: `${barUp ? 'bottom' : 'top'} ${corner}` } : null,
    menu: { top: menuTop, inlineStart: inline(menu.width), maxHeight: Math.max(0, maxHeight), origin: `${menuUp ? 'bottom' : 'top'} ${corner}` },
  });

  if (barNeed <= above && menuNeed <= below) return place('bar-above', top - barNeed, true, bottom + gap, false, menu.height);
  if (menuNeed <= above && barNeed <= below) return place('menu-above', bottom + gap, false, top - menuNeed, true, menu.height);
  if (barNeed + menuNeed <= above) return place('above', top - menuNeed - barNeed, true, top - menuNeed, true, menu.height);
  if (barNeed + menuNeed <= below) return place('below', bottom + gap, false, bottom + gap + barNeed, false, menu.height);

  // the card on the roomier side, scrolling; the reactions on the other side if they fit there, else next to the message
  const down = below >= above;
  const barAcross = barNeed <= (down ? above : below);
  const room = (down ? below : above) - gap - (barAcross ? 0 : barNeed);
  if (room >= Math.min(MESSAGE_MENU_MIN, menu.height)) {
    const height = Math.min(menu.height, room);
    if (down) {
      return barAcross
        ? place('scroll', top - barNeed, true, bottom + gap, false, room)
        : place('scroll', bottom + gap, false, bottom + gap + barNeed, false, room);
    }
    return barAcross
      ? place('scroll', bottom + gap, false, top - gap - height, true, room)
      : place('scroll', top - barNeed, true, top - barNeed - gap - height, true, room);
  }

  // over the message: the reactions at the top of the screen, the card at the bottom
  const avail = frame.height - 2 * EDGE - barNeed;
  return place('over', EDGE, false, frame.height - EDGE - Math.min(menu.height, avail), true, avail);
}

function clamp(x: number, min: number, max: number): number {
  return Math.max(min, Math.min(x, max));
}
