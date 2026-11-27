// Where the nav rail's accent bar goes for the active row (NavRail), when that row may be a pin in
// the communities list, which scrolls on its own. Positions are in px from the rail's top.

/** The bar's offset from the top of its row. */
export const BAR_INSET = 7;
/** The bar's height. */
export const BAR_HEIGHT = 28;

/** How much of the bar the list's edges cut off, at its top and its bottom. */
export type BarClip = { top: number; bottom: number };

/** The bar's top, and whether the list's edges cut it off in part (`clip`) or wholly (`hidden`). */
export type BarPlacement = { top: number; clip: BarClip | null; hidden: boolean };

/** The part of the communities list that shows, from the rail's top. */
export type ListView = { top: number; bottom: number };

/**
 * The bar for a row whose top is at `rowTop`. A row in the communities list (`list`, the part of
 * it that shows) gets the bar clipped to the list's edges. A pin scrolled wholly out of view hides
 * the bar, parked inside the list's box at the edge the pin went past: left where the pin is, it
 * could sit far below the rail and make the rail's own scroller scroll.
 */
export function barPlacement(rowTop: number, list: ListView | null): BarPlacement {
  const top = Math.round(rowTop) + BAR_INSET;
  if (list === null) return { top, clip: null, hidden: false };
  const clipTop = Math.max(0, Math.min(BAR_HEIGHT, list.top - top));
  const clipBottom = Math.max(0, Math.min(BAR_HEIGHT, top + BAR_HEIGHT - list.bottom));
  if (clipTop + clipBottom >= BAR_HEIGHT) {
    const parked = clipTop > 0 ? list.top : Math.max(list.top, list.bottom - BAR_HEIGHT);
    return { top: Math.round(parked), clip: null, hidden: true };
  }
  return { top, clip: clipTop > 0 || clipBottom > 0 ? { top: clipTop, bottom: clipBottom } : null, hidden: false };
}

/**
 * Whether the bar jumps to the next active row rather than sliding there: it was cut off by the
 * list's edges, in part or wholly, so a slide would start from a place outside the list, over the
 * rows around it.
 */
export function barJumps(previous: Pick<BarPlacement, 'clip' | 'hidden'> | null): boolean {
  return previous !== null && (previous.hidden || previous.clip !== null);
}
