import { describe, expect, test } from "vitest";
import {
    COLLAPSED_HEIGHT,
    dragFactor,
    dropIndex,
    factorFor,
    heightFor,
    isOpen,
    lookAt,
    maxHeight,
    moved,
    ramp,
    releaseTarget,
    releaseVelocity,
    ROW_PITCH,
    rowShift,
    settleAt,
    settleDuration,
    SETTLE_MS,
    withSample,
} from "./switcher";

describe("the switcher's factor", () => {
    const max = 668;

    test("is 0 at the strip and 1 at the sheet, in proportion between", () => {
        expect(factorFor(COLLAPSED_HEIGHT, max)).toBe(0);
        expect(factorFor(max, max)).toBe(1);
        expect(factorFor((COLLAPSED_HEIGHT + max) / 2, max)).toBeCloseTo(0.5);
        expect(factorFor(0, max)).toBe(0);
        expect(factorFor(max + 50, max)).toBe(1);
    });

    test("gives the height back", () => {
        expect(heightFor(0, max)).toBe(COLLAPSED_HEIGHT);
        expect(heightFor(1, max)).toBe(max);
        expect(heightFor(factorFor(400, max), max)).toBeCloseTo(400);
    });

    test("the sheet stops 118px under the screen's top, but grows at least 200px", () => {
        expect(maxHeight(786)).toBe(668);
        expect(maxHeight(300)).toBe(COLLAPSED_HEIGHT + 200);
    });
});

describe("what shows at f", () => {
    test("ramps between its ends", () => {
        expect(ramp(0.2, 0.4, 0.8)).toBe(0);
        expect(ramp(0.6, 0.4, 0.8)).toBeCloseTo(0.5);
        expect(ramp(0.9, 0.4, 0.8)).toBe(1);
    });

    test("the strip fades out over 0 → 0.4, the sheet's content in over 0.4 → 0.8", () => {
        expect(lookAt(0)).toMatchObject({ strip: 1, sheet: 0, fill: 0, radius: 10, dim: 0 });
        expect(lookAt(0.2).strip).toBeCloseTo(0.5);
        expect(lookAt(0.4)).toMatchObject({ strip: 0, sheet: 0 });
        expect(lookAt(0.6).sheet).toBeCloseTo(0.5);
        expect(lookAt(1)).toMatchObject({ strip: 0, sheet: 1, fill: 1, radius: 22, dim: 1 });
        expect(lookAt(1).shadow).toBeCloseTo(0.45);
    });

    test("open past halfway", () => {
        expect(isOpen(0.5)).toBe(false);
        expect(isOpen(0.51)).toBe(true);
    });
});

describe("a drag", () => {
    const max = 668;
    const range = max - COLLAPSED_HEIGHT;

    test("follows the finger: up grows it, within 0 and 1", () => {
        expect(dragFactor(0, -range / 2, max)).toBeCloseTo(0.5);
        expect(dragFactor(1, range / 4, max)).toBeCloseTo(0.75);
        expect(dragFactor(0, 40, max)).toBe(0);
        expect(dragFactor(1, -40, max)).toBe(1);
    });

    test("keeps its last six samples for the velocity", () => {
        let samples = [{ t: 0, y: 0 }];
        for (let i = 1; i <= 10; i++) samples = withSample(samples, { t: i * 10, y: i * -5 });
        expect(samples).toHaveLength(6);
        expect(samples[0]).toEqual({ t: 50, y: -25 });
        expect(releaseVelocity(samples)).toBeCloseTo(-0.5);
        expect(releaseVelocity([{ t: 0, y: 0 }])).toBe(0);
    });
});

describe("letting go", () => {
    test("a flick goes the way it was going", () => {
        expect(releaseTarget({ velocity: -0.5, elapsed: 600, distance: -10, f: 0.1 })).toBe(1);
        expect(releaseTarget({ velocity: 0.5, elapsed: 600, distance: 10, f: 0.9 })).toBe(0);
    });

    test("a quick drag goes the way it was going", () => {
        expect(releaseTarget({ velocity: -0.2, elapsed: 200, distance: -60, f: 0.1 })).toBe(1);
        expect(releaseTarget({ velocity: 0.2, elapsed: 200, distance: 60, f: 0.9 })).toBe(0);
        // too slow, or not far enough: where it is
        expect(releaseTarget({ velocity: -0.2, elapsed: 300, distance: -60, f: 0.1 })).toBe(0);
        expect(releaseTarget({ velocity: -0.2, elapsed: 200, distance: -50, f: 0.1 })).toBe(0);
    });

    test("otherwise it settles where it's nearer", () => {
        expect(releaseTarget({ velocity: 0, elapsed: 900, distance: -300, f: 0.6 })).toBe(1);
        expect(releaseTarget({ velocity: 0, elapsed: 900, distance: -200, f: 0.4 })).toBe(0);
    });

    test("settles in a time for the way left, eased out", () => {
        expect(settleDuration(0, 1)).toBe(SETTLE_MS);
        expect(settleDuration(0.9, 1)).toBeCloseTo(SETTLE_MS * 0.35);
        expect(settleAt(0, 1, 0, 100)).toBe(0);
        expect(settleAt(0, 1, 100, 100)).toBe(1);
        expect(settleAt(0, 1, 50, 100)).toBeCloseTo(0.875);
        expect(settleAt(1, 0, 200, 100)).toBe(0);
    });
});

describe("dragging a sheet row", () => {
    test("lands a row per pitch away, within the list", () => {
        expect(dropIndex(1, ROW_PITCH * 2, 5)).toBe(3);
        expect(dropIndex(1, -ROW_PITCH * 0.4, 5)).toBe(1);
        expect(dropIndex(1, -ROW_PITCH * 0.6, 5)).toBe(0);
        expect(dropIndex(3, ROW_PITCH * 9, 5)).toBe(4);
    });

    test("moves the item", () => {
        expect(moved(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
        expect(moved(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
        expect(moved(["a", "b"], 1, 1)).toEqual(["a", "b"]);
    });

    test("makes room: the rows passed shift a row the other way", () => {
        const dy = ROW_PITCH * 2;
        expect(rowShift(1, 1, dy, 5)).toBe(dy);
        expect(rowShift(0, 1, dy, 5)).toBe(0);
        expect(rowShift(2, 1, dy, 5)).toBe(-ROW_PITCH);
        expect(rowShift(3, 1, dy, 5)).toBe(-ROW_PITCH);
        expect(rowShift(4, 1, dy, 5)).toBe(0);
        expect(rowShift(0, 2, -ROW_PITCH * 2, 5)).toBe(ROW_PITCH);
        expect(rowShift(1, 2, -ROW_PITCH * 2, 5)).toBe(ROW_PITCH);
    });
});
