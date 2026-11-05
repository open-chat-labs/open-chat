import { cubicBezier, easeOut } from "./motion";

describe("a cubic-bezier easing", () => {
    test("starts at 0 and ends at 1", () => {
        expect(easeOut(0)).toBe(0);
        expect(easeOut(1)).toBe(1);
        expect(easeOut(-0.5)).toBe(0);
        expect(easeOut(1.5)).toBe(1);
    });

    test("is the identity for a straight line", () => {
        const linear = cubicBezier(0.25, 0.25, 0.75, 0.75);
        for (const t of [0.1, 0.33, 0.5, 0.9]) {
            expect(linear(t)).toBeCloseTo(t, 5);
        }
    });

    test("is --ease-out's curve: most of the way early, and never back", () => {
        // cubic-bezier(.2,.8,.2,1) as a browser computes it
        expect(easeOut(0.1)).toBeCloseTo(0.4, 1);
        expect(easeOut(0.5)).toBeCloseTo(0.93, 1);
        let last = 0;
        for (let t = 0; t <= 1; t += 0.01) {
            expect(easeOut(t)).toBeGreaterThanOrEqual(last);
            last = easeOut(t);
        }
    });

    test("matches the curve's points", () => {
        // for a parameter s, the curve's point (x(s), y(s)): the easing of x(s) is y(s)
        const ease = cubicBezier(0.42, 0, 0.58, 1);
        const point = (s: number) => {
            const b = (a: number, c: number) =>
                3 * a * s * (1 - s) ** 2 + 3 * c * s ** 2 * (1 - s) + s ** 3;
            return [b(0.42, 0.58), b(0, 1)];
        };
        for (const s of [0.2, 0.5, 0.8]) {
            const [x, y] = point(s);
            expect(ease(x)).toBeCloseTo(y, 5);
        }
    });
});
