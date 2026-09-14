import { describe, expect, test } from "vitest";
import { CELL, hitQuarter } from "./gridSvg";

function area(poly: [number, number][]): number {
    let twice = 0;
    for (let i = 0; i < poly.length; i++) {
        const [x1, y1] = poly[i];
        const [x2, y2] = poly[(i + 1) % poly.length];
        twice += x1 * y2 - x2 * y1;
    }
    return Math.abs(twice) / 2;
}

function contains(poly: [number, number][], x: number, y: number): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i];
        const [xj, yj] = poly[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}

// #9372 invariant 2, on the shapes as drawn: the four quarters partition the cell, so the two
// pairs an edge can own never overlap each other
describe("hitQuarter", () => {
    const origin = { x: 3 * CELL, y: 2 * CELL };
    const quarters = ["left", "right", "top", "bottom"] as const;

    test("the four quarters tile the cell exactly", () => {
        const total = quarters.reduce((sum, q) => sum + area(hitQuarter(origin, q)), 0);
        expect(total).toBeCloseTo(CELL * CELL, 6);
        expect(area(hitQuarter(origin, "whole"))).toBeCloseTo(CELL * CELL, 6);
        // every interior point falls in exactly one quarter
        for (let i = 1; i < 20; i++) {
            for (let j = 1; j < 20; j++) {
                const x = origin.x + (CELL * i) / 20 + 0.001;
                const y = origin.y + (CELL * j) / 20 + 0.002;
                const hits = quarters.filter((q) => contains(hitQuarter(origin, q), x, y));
                expect(hits, `${x},${y}`).toHaveLength(1);
            }
        }
    });

    test("left and right continue a horizontal line, top and bottom a vertical one", () => {
        const cx = origin.x + CELL / 2;
        const cy = origin.y + CELL / 2;
        expect(contains(hitQuarter(origin, "left"), cx - CELL / 4, cy)).toBe(true);
        expect(contains(hitQuarter(origin, "right"), cx + CELL / 4, cy)).toBe(true);
        expect(contains(hitQuarter(origin, "top"), cx, cy - CELL / 4)).toBe(true);
        expect(contains(hitQuarter(origin, "bottom"), cx, cy + CELL / 4)).toBe(true);
    });
});
