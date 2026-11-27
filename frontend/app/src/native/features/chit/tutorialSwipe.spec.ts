import { describe, expect, it } from "vitest";
import { tutorialSwipeStep } from "./tutorialSwipe";

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
