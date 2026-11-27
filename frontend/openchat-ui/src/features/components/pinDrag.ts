// The nav rail's communities, reordered by drag and drop (NavRail): where a dragged pin lands, how
// the others make room for it, and how fast the list scrolls while a pin is held near its edges.
// Positions are in the list's content (scrolled) coordinates, in px.

/** How far the pointer moves (px) before a press on a pin becomes a drag rather than a click. */
export const DRAG_THRESHOLD = 5;

/** Whether a press that moved by `dy` (px) since it went down has become a drag. */
export function dragStarted(dy: number): boolean {
  return Math.abs(dy) >= DRAG_THRESHOLD;
}

/**
 * The index the dragged row takes in the list, from where its centre is now (`centre`) and where
 * every row's centre rests (`mids`, in order, the dragged one's included at `from`): it goes after
 * each other row whose centre it has passed.
 */
export function dropIndex(from: number, centre: number, mids: readonly number[]): number {
  let index = 0;
  for (let i = 0; i < mids.length; i++) {
    if (i !== from && mids[i] < centre) index++;
  }
  return index;
}

/**
 * How far (px) the row at `i` moves to make room while the row at `from` is held over `to`: rows
 * between the two shift by one row's `pitch` (its height and the gap) towards where it came from.
 * The dragged row itself follows the pointer instead, so it gets 0.
 */
export function shiftFor(i: number, from: number, to: number, pitch: number): number {
  if (from < to && i > from && i <= to) return -pitch;
  if (to < from && i >= to && i < from) return pitch;
  return 0;
}

/** The list with the item at `from` moved to `to` (indexes outside the list leave it as it is). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const out = [...list];
  if (from === to || from < 0 || to < 0 || from >= out.length || to >= out.length) return out;
  const [item] = out.splice(from, 1);
  out.splice(to, 0, item);
  return out;
}

/** The band (px) at the list's top and bottom edges where a held pin scrolls the list. */
export const SCROLL_EDGE = 36;
/** The fastest the list scrolls (px per frame), with the pointer at or past an edge. */
export const SCROLL_MAX = 12;

/**
 * How far to scroll the list this frame (px; negative is up) with the pointer at `y`, between the
 * list's visible `top` and `bottom` (all in the viewport): faster the deeper into the edge's band.
 */
export function autoScrollStep(y: number, top: number, bottom: number): number {
  const intoTop = top + SCROLL_EDGE - y;
  if (intoTop > 0) return -Math.round(SCROLL_MAX * Math.min(1, intoTop / SCROLL_EDGE));
  const intoBottom = y - (bottom - SCROLL_EDGE);
  if (intoBottom > 0) return Math.round(SCROLL_MAX * Math.min(1, intoBottom / SCROLL_EDGE));
  return 0;
}
