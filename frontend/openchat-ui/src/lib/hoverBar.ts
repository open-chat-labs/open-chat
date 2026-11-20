// Where MessageGroup's hover bar sits for a message (web 05: over the bubble, slightly above its top edge, at its
// end where the bubble is wide enough, else at its start), and where the pointer keeps it showing. A deleted
// message's placeholder is a short bubble with a popover above its start edge: there the bar sits beside it, at its
// end (its start for a mirrored, right-aligned bubble), centred on it, so it covers neither (by hand, 2026-11-20).

/** The hover bar's width as laid out with all it can hold (3 reactions, picker, divider, reply / edit, more). */
export const BAR_W = 196;
/** The hover bar's height. */
export const BAR_H = 34;
/** The gap between a bubble and a bar beside it. */
export const BAR_GAP = 8;

/** A bubble's box within its message's row (px from the row's left and top edges). */
export type BubbleBox = { left: number; top: number; width: number; height: number };

/** The bar's position in its row: `left` or `right` from that edge, and `top` (none: its usual place above the bubble). */
export type BarPlacement = { left?: number; right?: number; top?: number };

export function barPlacement(bubble: BubbleBox, rowWidth: number, beside: boolean, mirrored: boolean): BarPlacement {
  if (beside) {
    const top = bubble.top + (bubble.height - BAR_H) / 2;
    return mirrored ? { right: rowWidth - bubble.left + BAR_GAP, top } : { left: bubble.left + bubble.width + BAR_GAP, top };
  }
  return { left: bubble.width >= BAR_W + 16 ? bubble.left + bubble.width - BAR_W - 8 : bubble.left };
}

/**
 * Whether a pointer at `x` (px from the row's left edge) is over the bubble, or the way to a bar beside it: crossing
 * the gap to that bar keeps it showing.
 */
export function overBubble(x: number, bubble: Pick<BubbleBox, 'left' | 'width'>, beside: boolean, mirrored: boolean): boolean {
  const reach = beside ? BAR_GAP + BAR_W : 0;
  const start = bubble.left - (beside && mirrored ? reach : 0);
  const end = bubble.left + bubble.width + (beside && !mirrored ? reach : 0);
  return x >= start && x <= end;
}
