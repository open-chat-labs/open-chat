import { describe, expect, it } from "vitest";
import { buildPrefixSums, computeSpacers, computeWindow, getHeight } from "./virtualListUtils";

const AVG = 100;
const VIEWPORT = 600;

// Use zero overscan in most tests so the expected window is easy to reason about.
const NO_OVERSCAN = 0;

function uniformHeights(count: number, h: number): number[] {
    return Array.from({ length: count }, () => h);
}

// Helper: build prefix sums for tests.
function prefix(count: number, heightMap: number[] = [], avg: number = AVG): number[] {
    return buildPrefixSums(count, heightMap, avg);
}

describe("getHeight", () => {
    it("returns averageHeight for unmeasured items", () => {
        expect(getHeight([], AVG, 0)).toBe(AVG);
        expect(getHeight([0], AVG, 0)).toBe(AVG);
    });

    it("returns measured height when available", () => {
        expect(getHeight([150], AVG, 0)).toBe(150);
    });
});

describe("buildPrefixSums", () => {
    it("returns [0] for empty list", () => {
        const p = buildPrefixSums(0, [], AVG);
        expect(p.length).toBe(1);
        expect(p[0]).toBe(0);
    });

    it("cumulates heights correctly", () => {
        const p = buildPrefixSums(3, [50, 100, 200], AVG);
        expect(p[0]).toBe(0);
        expect(p[1]).toBe(50);
        expect(p[2]).toBe(150);
        expect(p[3]).toBe(350);
    });

    it("uses averageHeight for unmeasured items", () => {
        const p = buildPrefixSums(3, [], AVG);
        expect(p[1]).toBe(100);
        expect(p[2]).toBe(200);
        expect(p[3]).toBe(300);
    });
});

describe("computeWindow", () => {
    it("returns [0,0] for empty list", () => {
        expect(computeWindow(0, prefix(0), 0, VIEWPORT, NO_OVERSCAN)).toEqual([0, 0]);
    });

    it("at the bottom (fromBottom=0) starts from item 0", () => {
        // 10 items × 100px = 1000px. Viewport=600. fromBottom=0 means visual bottom.
        // No overscan. endPos(i) = prefix[i+1] + 0 (no gap).
        // Start: first i where prefix[i+1] > 0 → i=0 (prefix[1]=100 > 0). s=0.
        // End: first i where prefix[i] > 600. prefix[7]=700 > 600 → e=7.
        const [s, e] = computeWindow(10, prefix(10), 0, VIEWPORT, NO_OVERSCAN);
        expect(s).toBe(0);
        expect(e).toBe(7);
    });

    it("scrolled past first N items", () => {
        // fromBottom=200. lowThresh=200, highThresh=800.
        // Start: first i where prefix[i+1] > 200. prefix[3]=300 > 200 → s=2.
        // End: first i where prefix[i] > 800. prefix[9]=900 > 800 → e=9.
        const [s, e] = computeWindow(10, prefix(10), 200, VIEWPORT, NO_OVERSCAN);
        expect(s).toBe(2);
        expect(e).toBe(9);
    });

    it("uses measured heights from heightMap", () => {
        // Item 0 is 50px, rest AVG=100px. fb=0, ve=600.
        const heightMap = [50];
        const [s, e] = computeWindow(10, prefix(10, heightMap), 0, VIEWPORT, NO_OVERSCAN);
        expect(s).toBe(0);
        expect(e).toBe(7);
    });

    it("includes overscan items beyond the viewport edges", () => {
        // fromBottom=0, viewport=600, overscan=OVERSCAN_PX(1200).
        // Visible range with overscan: [max(0, 0-1200), 600+1200) = [0, 1800).
        // 10 items × 100px = 1000px. All 10 items covered.
        const [s, e] = computeWindow(10, prefix(10), 0, VIEWPORT);
        expect(s).toBe(0);
        expect(e).toBe(10);
    });

    it("clamps start to 0", () => {
        const [s] = computeWindow(5, prefix(5), 0, VIEWPORT, NO_OVERSCAN);
        expect(s).toBeGreaterThanOrEqual(0);
    });

    it("clamps end to itemCount", () => {
        // Scroll far enough that the window would extend beyond N.
        const [, e] = computeWindow(5, prefix(5), 0, 10000, NO_OVERSCAN);
        expect(e).toBe(5);
    });

    it("scrolled beyond all items returns [N, N]", () => {
        // fromBottom = 1000, total height = 10×100 = 1000. No items above 1000.
        const [s, e] = computeWindow(10, prefix(10), 1000, VIEWPORT, NO_OVERSCAN);
        expect(s).toBe(10);
        expect(e).toBe(10);
    });

    it("single item", () => {
        const [s, e] = computeWindow(1, prefix(1), 0, VIEWPORT, NO_OVERSCAN);
        expect(s).toBe(0);
        expect(e).toBe(1);
    });
});

describe("computeSpacers", () => {
    it("no spacers when window covers all items", () => {
        const N = 5;
        const [bh, th] = computeSpacers(N, prefix(N), 0, N);
        expect(bh).toBe(0);
        expect(th).toBe(0);
    });

    it("bottom spacer covers items before start", () => {
        // start=3, end=7, AVG=100. Bottom spacer = items 0,1,2 = 300px.
        const [bh] = computeSpacers(10, prefix(10), 3, 7);
        expect(bh).toBe(300);
    });

    it("top spacer covers items from end onward", () => {
        // start=3, end=7, N=10. Top spacer = items 7,8,9 = 300px.
        const [, th] = computeSpacers(10, prefix(10), 3, 7);
        expect(th).toBe(300);
    });

    it("spacers + window = total height", () => {
        const N = 10;
        const heights = uniformHeights(N, AVG);
        const p = prefix(N, heights);
        const [s, e] = computeWindow(N, p, 250, VIEWPORT, NO_OVERSCAN);
        const [bh, th] = computeSpacers(N, p, s, e);
        const windowHeight = heights.slice(s, e).reduce((a, b) => a + b, 0);
        expect(bh + windowHeight + th).toBe(N * AVG);
    });

    it("uses measured heights in spacer calculation", () => {
        // Item 0 measured at 50px (not AVG=100). start=1, end=5.
        // Bottom spacer = item 0 = 50px.
        const heightMap = [50];
        const [bh] = computeSpacers(10, prefix(10, heightMap), 1, 5);
        expect(bh).toBe(50);
    });

    it("includes inter-item gaps in spacers", () => {
        const GAP = 4;
        // start=3, end=7, AVG=100, gap=4.
        // Bottom spacer: items 0,1,2 = 300px + 2 gaps = 308px.
        const [bh, th] = computeSpacers(10, prefix(10), 3, 7, GAP);
        expect(bh).toBe(300 + 2 * GAP);
        // Top spacer: items 7,8,9 = 300px + 2 gaps = 308px.
        expect(th).toBe(300 + 2 * GAP);
    });

    it("no gap for single-item spacer", () => {
        const GAP = 4;
        // start=1: only item 0 in bottom spacer. No inter-item gaps.
        const [bh] = computeSpacers(10, prefix(10), 1, 5, GAP);
        expect(bh).toBe(100);
    });

    it("spacers + window + flex gaps = total content height with gap", () => {
        const N = 10;
        const GAP = 4;
        const heights = uniformHeights(N, AVG);
        const p = prefix(N, heights);
        const [s, e] = computeWindow(N, p, 250, VIEWPORT, NO_OVERSCAN, GAP);
        const [bh, th] = computeSpacers(N, p, s, e, GAP);
        const windowHeight = heights.slice(s, e).reduce((a, b) => a + b, 0);
        // Flex children: 2 spacers + (e-s) items. Flex gaps = (e-s+1).
        // Total should equal sum(all heights) + (N-1) gaps.
        const totalNonVirtual = N * AVG + (N - 1) * GAP;
        const flexGaps = (e - s + 1) * GAP; // both spacers present
        expect(bh + windowHeight + th + flexGaps).toBe(totalNonVirtual);
    });
});
