// Swiping through the puzzle tutorial's steps: drag the tutorial sideways and let go, and it steps
// on (dragging towards the inline start: left in LTR) or back. The thresholds are the tab swipe's
// (shell/tabSwipe.ts), so the two feel the same; there's no step before the first or after the
// last, so a swipe that way does nothing. Pure, so the screen only feeds it pointer positions.

import { swipeAxis, swipeRelease, type SwipeAxis } from "../../shell/tabSwipe";

export type TutorialDrag = {
    /** How far the pointer has moved across (rightwards positive) and down, in px. */
    dx: number;
    dy: number;
    /** The tutorial's width, px. */
    width: number;
    /** How fast the pointer was moving across as it was let go (px/ms, rightwards positive). */
    velocity: number;
};

/** Which way a drag is going: a sideways one is the tutorial's, a vertical one a scroll. */
export function tutorialSwipeAxis(dx: number, dy: number): SwipeAxis {
    return swipeAxis(dx, dy);
}

/**
 * The step a released sideways drag goes to, from step `index` of `count`: the next or the one
 * before past 30% of the width or with a flick, else undefined (nothing changes).
 */
export function tutorialSwipeStep(
    drag: TutorialDrag,
    index: number,
    count: number,
    rtl: boolean,
): number | undefined {
    if (swipeAxis(drag.dx, drag.dy) !== "sideways") return undefined;
    return swipeRelease(drag.dx, drag.width, drag.velocity, index, count, rtl);
}
