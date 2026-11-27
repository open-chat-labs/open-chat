import { describe, expect, it } from "vitest";
import { RUBBER_BAND } from "../../shell/tabSwipe";
import {
    SLIDE_MS,
    stepDotWeight,
    tutorialDragView,
    tutorialSlide,
    tutorialSpringBack,
    tutorialSwipeAxis,
    tutorialSwipeStarts,
    tutorialSwipeStep,
} from "./tutorialSwipe";

const drag = (dx: number, dy = 0, velocity = 0, width = 400) => ({ dx, dy, width, velocity });

describe("swiping through the puzzle tutorial", () => {
    it("steps on for a drag left past 30% of the width, and back for one right", () => {
        expect(tutorialSwipeStep(drag(-150), 2, 6, false)).toBe(3);
        expect(tutorialSwipeStep(drag(150), 2, 6, false)).toBe(1);
    });

    it("steps on for a short flick", () => {
        expect(tutorialSwipeStep(drag(-40, 0, -0.8), 2, 6, false)).toBe(3);
    });

    it("does nothing for a short slow drag, or a mostly vertical one", () => {
        expect(tutorialSwipeStep(drag(-40, 0, -0.1), 2, 6, false)).toBeUndefined();
        expect(tutorialSwipeStep(drag(-150, 300), 2, 6, false)).toBeUndefined();
    });

    it("has no step before the first or after the last", () => {
        expect(tutorialSwipeStep(drag(150), 0, 6, false)).toBeUndefined();
        expect(tutorialSwipeStep(drag(-150), 5, 6, false)).toBeUndefined();
    });

    it("is mirrored in RTL", () => {
        expect(tutorialSwipeStep(drag(150), 2, 6, true)).toBe(3);
        expect(tutorialSwipeStep(drag(-150), 2, 6, true)).toBe(1);
    });
});

describe("dragging the puzzle tutorial", () => {
    it("moves the step with the finger, the next one coming in from the inline end", () => {
        expect(tutorialDragView(-100, 400, 2, 6, false, false)).toEqual({
            offset: -100,
            neighbour: 3,
            progress: 0.25,
        });
        expect(tutorialDragView(100, 400, 2, 6, false, false)).toMatchObject({
            offset: 100,
            neighbour: 1,
        });
    });

    it("rubber-bands towards no step, with nothing coming in", () => {
        const first = tutorialDragView(200, 400, 0, 6, false, false);
        expect(first.neighbour).toBeUndefined();
        expect(first.progress).toBe(0);
        expect(first.offset).toBe(50);
        expect(tutorialDragView(-1000, 400, 5, 6, false, false).offset).toBe(-RUBBER_BAND);
    });

    it("is mirrored in RTL", () => {
        expect(tutorialDragView(100, 400, 2, 6, true, false).neighbour).toBe(3);
        expect(tutorialDragView(-100, 400, 0, 6, true, false).neighbour).toBeUndefined();
    });

    it("doesn't move with reduced motion", () => {
        expect(tutorialDragView(-100, 400, 2, 6, false, true)).toEqual({
            offset: 0,
            neighbour: undefined,
            progress: 0,
        });
    });

    it("leaves vertical drags to the scroll, and the window's sides to the system", () => {
        expect(tutorialSwipeAxis(4, 40)).toBe("vertical");
        expect(tutorialSwipeAxis(40, 4)).toBe("sideways");
        expect(tutorialSwipeAxis(3, 3)).toBe("undecided");
        expect(tutorialSwipeStarts(5, 400)).toBe(false);
        expect(tutorialSwipeStarts(395, 400)).toBe(false);
        expect(tutorialSwipeStarts(200, 400)).toBe(true);
    });
});

describe("the tutorial's step change", () => {
    it("after a drag, carries on from where it was let go, in what's left of the time", () => {
        // dragged 160px left of 400: the next step was 240px in from the right
        const slide = tutorialSlide(2, 3, 400, false, -160);
        expect(slide.incoming).toEqual([240, 0]);
        expect(slide.outgoing).toEqual([-160, -400]);
        expect(slide.duration).toBeCloseTo(SLIDE_MS * 0.6);
        // back a step: the one before was on the left
        expect(tutorialSlide(2, 1, 400, false, 160).incoming).toEqual([-240, 0]);
    });

    it("from Back or Next, slides the new step in from its side, mirrored in RTL", () => {
        expect(tutorialSlide(2, 3, 400, false)).toEqual({
            incoming: [400, 0],
            outgoing: [0, -400],
            duration: SLIDE_MS,
        });
        expect(tutorialSlide(2, 1, 400, false).incoming).toEqual([-400, 0]);
        expect(tutorialSlide(2, 3, 400, true).incoming).toEqual([-400, 0]);
    });

    it("springs a short drag back, its neighbour back out beside it", () => {
        const spring = tutorialSpringBack(-80, 400);
        expect(spring.incoming).toEqual([-80, 0]);
        expect(spring.outgoing).toEqual([320, 400]);
    });

    it("hands the long step dot over as the drag goes", () => {
        expect(stepDotWeight(2, 2, undefined, 0)).toBe(1);
        expect(stepDotWeight(3, 2, undefined, 0)).toBe(0);
        expect(stepDotWeight(2, 2, 3, 0.25)).toBe(0.75);
        expect(stepDotWeight(3, 2, 3, 0.25)).toBe(0.25);
        expect(stepDotWeight(4, 2, 3, 0.25)).toBe(0);
    });
});
