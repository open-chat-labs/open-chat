// Swiping between the tabs on a tab's root (#10421): drag the screen sideways and the neighbouring
// tab, in the tab bar's order, comes in alongside it; past SWITCH_FRACTION of the width, or with a
// flick, it switches to that tab, otherwise it springs back. There's no tab before the first or
// after the last, so a drag that way rubber-bands. Mirrored in RTL. Pure, so the shell only feeds it
// pointer positions; the pixel values are the shell's own (the design has no swipe between tabs).

/** A drag is told apart as sideways or up-and-down once it has moved this far (px). */
export const AXIS_LOCK = 10;
/** Drags starting this close to the window's side are left to the system (iOS's edge swipe). */
export const EDGE_GUARD = 16;
/** The share of the width a drag goes past to switch on release. */
export const SWITCH_FRACTION = 0.3;
/** A release faster than this (px/ms) the way it was dragged is a flick, which switches. */
export const FLICK_VELOCITY = 0.45;
/** A flick has to have moved at least this far, so a tap's jitter isn't one. */
export const FLICK_MIN_DISTANCE = 24;
/** How far a drag towards no tab follows the finger, at most (a quarter of the pull until then). */
export const RUBBER_BAND = 56;

export type SwipeAxis = "undecided" | "sideways" | "vertical";

/** Whether a drag starting `x` px from the window's start edge can swipe, in a window `width` wide. */
export function startsSwipe(x: number, width: number): boolean {
    return x >= EDGE_GUARD && x <= width - EDGE_GUARD;
}

/**
 * Which way a drag is going after moving `dx`, `dy` px: undecided until it has gone AXIS_LOCK;
 * then sideways only if it's gone further across than up or down, so a drag that starts mostly
 * vertical is a scroll.
 */
export function swipeAxis(dx: number, dy: number): SwipeAxis {
    if (Math.hypot(dx, dy) < AXIS_LOCK) return "undecided";
    return Math.abs(dx) > Math.abs(dy) ? "sideways" : "vertical";
}

/**
 * The step through the tabs a drag `dx` px across leads to: +1 the next tab (it comes in from the
 * inline end: dragging left in LTR, right in RTL), -1 the one before, 0 for no drag.
 */
export function swipeStep(dx: number, rtl: boolean): -1 | 0 | 1 {
    if (dx === 0) return 0;
    return dx < 0 !== rtl ? 1 : -1;
}

/**
 * Where the screen showing sits (px across) for a drag `dx` px across, on the tab at `index` of
 * `count`: under the finger towards a tab, rubber-banded towards none.
 */
export function swipeOffset(dx: number, index: number, count: number, rtl: boolean): number {
    const target = index + swipeStep(dx, rtl);
    if (target >= 0 && target < count) return dx;
    return Math.sign(dx) * Math.min(RUBBER_BAND, Math.abs(dx) / 4);
}

/**
 * What letting go does, for a drag `dx` px across a screen `width` wide, moving at `velocity`
 * px/ms (rightwards positive), on the tab at `index` of `count`: the index of the tab to switch
 * to, or undefined to spring back.
 */
export function swipeRelease(
    dx: number,
    width: number,
    velocity: number,
    index: number,
    count: number,
    rtl: boolean,
): number | undefined {
    const target = index + swipeStep(dx, rtl);
    if (target === index || target < 0 || target >= count) return undefined;
    if (Math.abs(dx) > width * SWITCH_FRACTION) return target;
    const flick =
        Math.sign(velocity) === Math.sign(dx) &&
        Math.abs(velocity) > FLICK_VELOCITY &&
        Math.abs(dx) > FLICK_MIN_DISTANCE;
    return flick ? target : undefined;
}

/**
 * The tab switch's motion, as shares of the width (rightwards positive): where the new tab's screen
 * starts and where the old one goes. Only those two move, whichever tabs lie between: the new one
 * comes in from the inline end when it's further along the bar, from the start when it's before.
 */
export function tabSlide(
    fromIndex: number,
    toIndex: number,
    rtl: boolean,
): { incomingFrom: number; outgoingTo: number } {
    const forward = toIndex > fromIndex;
    const side = forward !== rtl ? 1 : -1;
    return { incomingFrom: side, outgoingTo: -side };
}
