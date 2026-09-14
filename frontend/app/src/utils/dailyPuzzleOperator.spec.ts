import { describe, expect, test } from "vitest";
import { regenerateOptions, withEnabled } from "./dailyPuzzleOperator";

// Every field off its default, so a dropped or reset one would show
const config = {
    enabled: false,
    entryFee: 123,
    firstPlayFree: false,
    rewardByStreak: [1, 2, 3],
    hintPenalty: 7,
    minCardedSolveMs: 4242n,
    maxSubmits: 9,
    maxFreeChecks: 11,
};

describe("enabling the daily puzzle (#9334 invariant 52)", () => {
    test("changes the flag and nothing else", () => {
        expect(withEnabled(config, true)).toEqual({ ...config, enabled: true });
        expect(withEnabled({ ...config, enabled: true }, false)).toEqual(config);
    });
});

describe("regenerate today options (#9334 invariant 54)", () => {
    test("as scheduled plus one entry per game the canister reports", () => {
        const games: [string, { hintPrices: number[]; maxHints: number }][] = [
            ["light_up", { hintPrices: [25, 75, 200], maxHints: 3 }],
            ["tents", { hintPrices: [25, 75, 200], maxHints: 3 }],
        ];
        expect(regenerateOptions(games)).toEqual([
            { value: "", label: "As scheduled" },
            { value: "light_up", label: "light_up" },
            { value: "tents", label: "tents" },
        ]);
    });

    test("no game configs leaves only as scheduled", () => {
        expect(regenerateOptions([])).toEqual([{ value: "", label: "As scheduled" }]);
    });
});
