import { describe, expect, test } from "vitest";
import {
    configToForm,
    formToConfig,
    formToGameConfig,
    formToSchedule,
    gameConfigToForm,
    regenerateOptions,
    scheduleToForm,
} from "./dailyPuzzleOperator";

// Every field differs from the canister's Default, so a field dropped or defaulted on either
// leg of the round-trip changes the result.
const config = {
    enabled: true,
    entryFee: 123,
    firstPlayFree: false,
    rewardByStreak: [1, 2, 3, 4, 5, 6, 7, 8],
    hintPenalty: 77,
    minCardedSolveMs: BigInt(12_345),
    maxSubmits: 9,
    maxFreeChecks: 11,
};

const gameConfig = { hintPrices: [10, 20, 30, 40], maxHints: 4 };

const schedule = [
    { gameId: "light_up", width: 7, height: 7, tier: 0, blackPct: 20 },
    { gameId: "unruly", width: 8, height: 8, tier: 1, blackPct: 0 },
    { gameId: "light_up", width: 9, height: 9, tier: 1, blackPct: 25 },
    { gameId: "unruly", width: 10, height: 10, tier: 0, blackPct: 0 },
    { gameId: "light_up", width: 11, height: 11, tier: 0, blackPct: 30 },
    { gameId: "unruly", width: 12, height: 12, tier: 1, blackPct: 0 },
    { gameId: "light_up", width: 13, height: 13, tier: 1, blackPct: 35 },
];

describe("daily puzzle operator forms carry every field (#9334 invariant 52)", () => {
    test("series config round-trips unchanged", () => {
        expect(formToConfig(configToForm(config))).toEqual(config);
    });

    test("series form holds the canister's values as strings, nothing write-only", () => {
        expect(configToForm(config)).toEqual({
            enabled: true,
            entryFee: "123",
            firstPlayFree: false,
            rewardByStreak: "1, 2, 3, 4, 5, 6, 7, 8",
            hintPenalty: "77",
            minCardedSolveMs: "12345",
            maxSubmits: "9",
            maxFreeChecks: "11",
        });
    });

    test("game config round-trips unchanged", () => {
        expect(formToGameConfig(gameConfigToForm(gameConfig))).toEqual(gameConfig);
    });

    test("schedule round-trips unchanged, all seven days", () => {
        expect(formToSchedule(scheduleToForm(schedule))).toEqual(schedule);
    });

    test("list fields tolerate loose comma spacing and a trailing comma", () => {
        expect(formToConfig({ ...configToForm(config), rewardByStreak: "5,6 ,7," })).toEqual({
            ...config,
            rewardByStreak: [5, 6, 7],
        });
    });
});

describe("regenerate today options (#9334 invariant 54)", () => {
    test("as scheduled plus one entry per game the canister reports", () => {
        expect(
            regenerateOptions([
                ["light_up", gameConfig],
                ["unruly", gameConfig],
            ]),
        ).toEqual([
            { value: "", label: "As scheduled" },
            { value: "light_up", label: "light_up" },
            { value: "unruly", label: "unruly" },
        ]);
    });

    test("no game configs leaves only as scheduled", () => {
        expect(regenerateOptions([])).toEqual([{ value: "", label: "As scheduled" }]);
    });
});
