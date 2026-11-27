// Swiping through the puzzle tutorial's steps, as the shell swipes between its tabs (shell/
// tabSwipe.ts, whose thresholds and rubber band these are, so the two feel the same): drag the
// step sideways and it follows the finger while the next one (dragging towards the inline start:
// left in LTR) or the one before comes in alongside it; past 30% of the width, or with a flick, it
// goes on to that step, otherwise it springs back. There's no step before the first or after the
// last, so a drag that way rubber-bands. Back and Next slide the steps the same way, and the step
// dots follow the drag. Pure, so the screen only feeds it pointer positions and draws what it says.

import {
    startsSwipe,
    swipeAxis,
    swipeOffset,
    swipeRelease,
    swipeStep,
    tabSlide,
    type SwipeAxis,
} from "../../shell/tabSwipe";

/** A step change's slide, as the shell's tab switch. */
export const SLIDE_MS = 320;
/** A spring back, as the shell's. */
export const SPRING_MS = 240;
/** The shortest slide finishing a drag that has nearly got there already. */
const MIN_SLIDE_MS = 120;

export type TutorialDrag = {
    /** How far the pointer has moved across (rightwards positive) and down, in px. */
    dx: number;
    dy: number;
    /** The tutorial's width, px. */
    width: number;
    /** How fast the pointer was moving across as it was let go (px/ms, rightwards positive). */
    velocity: number;
};

/** Whether a drag starting `x` px from the window's start edge may swipe the tutorial: one at the
 *  window's side is the system's (the back gesture), as for the shell's tabs. */
export function tutorialSwipeStarts(x: number, windowWidth: number): boolean {
    return startsSwipe(x, windowWidth);
}

/** Which way a drag is going: a sideways one is the tutorial's, a vertical one a scroll. */
export function tutorialSwipeAxis(dx: number, dy: number): SwipeAxis {
    return swipeAxis(dx, dy);
}

/** What a sideways drag shows. */
export type TutorialDragView = {
    /** Where the step showing sits, px across (rightwards positive). */
    offset: number;
    /** The step coming in beside it, on the side the drag leaves open; none towards no step. */
    neighbour: number | undefined;
    /** How far the neighbour has come in, 0 to 1 (the step dots follow it). */
    progress: number;
};

/**
 * What a sideways drag `dx` px across a tutorial `width` wide shows, on step `index` of `count`:
 * the step under the finger with its neighbour beside it, or rubber-banded towards no step. With
 * reduced motion nothing moves: the step changes on release, at once.
 */
export function tutorialDragView(
    dx: number,
    width: number,
    index: number,
    count: number,
    rtl: boolean,
    reducedMotion: boolean,
): TutorialDragView {
    const target = index + swipeStep(dx, rtl);
    const neighbour = target !== index && target >= 0 && target < count ? target : undefined;
    if (reducedMotion) return { offset: 0, neighbour: undefined, progress: 0 };
    return {
        offset: swipeOffset(dx, index, count, rtl),
        neighbour,
        progress: neighbour === undefined || width <= 0 ? 0 : Math.min(1, Math.abs(dx) / width),
    };
}

/** Where the neighbour of a step `offset` px across sits: a width further, on the side the drag
 *  leaves open. */
export function neighbourOffset(offset: number, width: number): number {
    return offset - Math.sign(offset) * width;
}

/**
 * The step a released sideways drag goes to, from step `index` of `count`: the next or the one
 * before past 30% of the width or with a flick, else undefined (it springs back).
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

/** A step change's motion, in px across (rightwards positive): the step coming in goes from
 *  `incoming[0]` to `incoming[1]`, the one leaving from `outgoing[0]` to `outgoing[1]`. */
export type TutorialSlide = {
    incoming: [number, number];
    outgoing: [number, number];
    duration: number;
};

/**
 * The slide from step `from` to step `to` on a tutorial `width` wide. After a drag (`offset`, the
 * step's place as it was let go) both carry on from where the drag left them, in what's left of
 * the slide's time; from Back, Next or a tap, the new step comes in from the side it lies on, as
 * the shell's tabs do (tabSlide).
 */
export function tutorialSlide(
    from: number,
    to: number,
    width: number,
    rtl: boolean,
    offset = 0,
): TutorialSlide {
    if (offset !== 0 && width > 0) {
        const start = neighbourOffset(offset, width);
        return {
            incoming: [start, 0],
            outgoing: [offset, offset - start],
            duration: Math.max(MIN_SLIDE_MS, SLIDE_MS * (Math.abs(start) / width)),
        };
    }
    const slide = tabSlide(from, to, rtl);
    return {
        incoming: [slide.incomingFrom * width, 0],
        outgoing: [0, slide.outgoingTo * width],
        duration: SLIDE_MS,
    };
}

/** A drag let go short of switching: the step back from `offset` to 0, its neighbour back out to
 *  where it came from. */
export function tutorialSpringBack(offset: number, width: number): TutorialSlide {
    const beside = neighbourOffset(offset, width);
    return {
        incoming: [offset, 0],
        outgoing: [beside, beside - offset],
        duration: SPRING_MS,
    };
}

/**
 * How much step dot `i` is the current one, 0 to 1 (the current dot is the long one): the step
 * showing's, handing over to the neighbour's as a drag brings it in.
 */
export function stepDotWeight(
    i: number,
    index: number,
    neighbour: number | undefined,
    progress: number,
): number {
    if (neighbour === undefined) return i === index ? 1 : 0;
    if (i === index) return 1 - progress;
    if (i === neighbour) return progress;
    return 0;
}
