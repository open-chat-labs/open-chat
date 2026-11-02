import { describe, expect, test } from "vitest";
import { swapMinimumOut } from "./swap";

describe("a swap's minimum output", () => {
    test("is the quote less the slippage, rounded down; 98% when none is chosen; kept within 0.01%–50%", () => {
        expect(swapMinimumOut(5_000_000_000n)).toBe(4_900_000_000n);
        expect(swapMinimumOut(5_000_000_000n, 0.1)).toBe(4_995_000_000n);
        expect(swapMinimumOut(5_000_000_000n, 3)).toBe(4_850_000_000n);
        // rounded down: never above what the slippage allows
        expect(swapMinimumOut(999n, 0.5)).toBe(994n);
        expect(swapMinimumOut(10_000n, 0)).toBe(9_999n);
        expect(swapMinimumOut(10_000n, 90)).toBe(5_000n);
        expect(swapMinimumOut(10_000n, Number.NaN)).toBe(9_800n);
    });
});
