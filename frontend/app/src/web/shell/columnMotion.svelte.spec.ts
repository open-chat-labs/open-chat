import { ColumnMotion } from "./columnMotion.svelte";

describe("the right column's motion", () => {
    test("opening plays the way in, and the column stays once it ends", () => {
        const motion = new ColumnMotion(false, "dock");
        expect(motion.shown).toBe(false);
        motion.update(true, "dock");
        expect([motion.shown, motion.entering, motion.closing]).toEqual([true, true, false]);
        motion.ended();
        expect([motion.shown, motion.entering]).toEqual([true, false]);
    });

    test("closing keeps it in the page until the way out ends", () => {
        const motion = new ColumnMotion(true, "modal");
        motion.update(false, "modal");
        expect([motion.shown, motion.entering, motion.closing]).toEqual([true, false, true]);
        motion.ended();
        expect(motion.shown).toBe(false);
    });

    test("crossing the docking width swaps the form without motion, open or closing", () => {
        const motion = new ColumnMotion(true, "dock");
        motion.update(true, "modal");
        expect([motion.shown, motion.entering, motion.closing]).toEqual([true, false, false]);
        // the modal closes as the window widens past the docking width (RightColumnState)
        motion.update(false, "dock");
        expect([motion.shown, motion.closing]).toEqual([false, false]);
    });

    test("crossing mid-motion stops it: the new form shows as it is", () => {
        const motion = new ColumnMotion(false, "dock");
        motion.update(true, "dock");
        motion.update(true, "modal");
        expect([motion.shown, motion.entering, motion.closing]).toEqual([true, false, false]);
    });

    test("reopened while it closes, it's open at once rather than growing again from nothing", () => {
        const motion = new ColumnMotion(true, "dock");
        motion.update(false, "dock");
        motion.update(true, "dock");
        expect([motion.shown, motion.entering, motion.closing]).toEqual([true, false, false]);
    });

    test("closed while it opens, it's gone at once rather than shrinking from its full width", () => {
        const motion = new ColumnMotion(false, "modal");
        motion.update(true, "modal");
        motion.update(false, "modal");
        expect([motion.shown, motion.entering, motion.closing]).toEqual([false, false, false]);
    });

    test("an unchanged state plays nothing", () => {
        const motion = new ColumnMotion(true, "dock");
        motion.update(true, "dock");
        expect([motion.entering, motion.closing]).toEqual([false, false]);
    });
});
