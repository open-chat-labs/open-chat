import { configKeys } from "@shared";
import { afterEach, describe, expect, it, vi } from "vitest";

async function load() {
    vi.resetModules();
    return import("./colours");
}

// WCAG relative luminance of a #rrggbb colour.
function luminance(hex: string): number {
    const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

describe("unruly disc colours", () => {
    afterEach(() => localStorage.clear());

    /** Invariant: a stored choice that names no pair (one since removed, or junk) shows the
     * default pair rather than leaving the board without colours. */
    it("falls back to the first pair for a stored index with no pair", async () => {
        for (const stored of ["99", "-1", "1.5", "junk"]) {
            localStorage.setItem(configKeys.unrulyColours, stored);
            const { discPairIndex } = await load();
            expect(discPairIndex.value, stored).toBe(0);
        }
    });

    /** Invariant: in every pair the first colour is the lighter by a contrast ratio of at least
     * 3. The difference keeps them apart under every common kind of colour blindness, and the
     * order matters because every locale calls value 1 "light" and value 2 "dark". */
    it("makes the first colour of every pair the lighter, by a clear margin", async () => {
        const { discPairs } = await load();
        for (const { a, b } of discPairs) {
            const ratio = (luminance(a) + 0.05) / (luminance(b) + 0.05);
            expect(ratio, `${a} / ${b}`).toBeGreaterThanOrEqual(3);
        }
    });
});
