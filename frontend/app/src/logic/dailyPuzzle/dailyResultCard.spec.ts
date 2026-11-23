import type {
    DailyPuzzleSolved,
    DailyPuzzleState,
    DailyPuzzleUserState,
    DailyResultContent,
    PublicDailyPuzzle,
} from "@client";
import { describe, expect, test } from "vitest";
import {
    canShareResult,
    cardNumbers,
    cardOffersPlay,
    cardOffersPlayWith,
    resultCard,
    shareableResultCard,
    verificationFrom,
} from "./dailyResultCard";

const row = {
    gameId: "light_up",
    number: 20706,
    userId: "u1",
    solveTimeMs: BigInt(61_000),
    hintsUsed: 2,
    streak: 7,
    solvedAt: BigInt(1),
};

describe("daily result card numbers (#9332 invariant 44)", () => {
    test("a card with no results row shows no numbers", () => {
        expect(verificationFrom({}, "u1")).toEqual({ kind: "unverified" });
        expect(cardNumbers({ kind: "unverified" })).toBeUndefined();
        expect(cardNumbers({ kind: "pending" })).toBeUndefined();
    });

    test("a card with a row shows the row's numbers", () => {
        const verification = verificationFrom({ u1: row }, "u1");
        expect(verification).toEqual({ kind: "verified", row });
        expect(cardNumbers(verification)).toEqual({
            solveTimeMs: 61_000,
            hintsUsed: 2,
            streak: 7,
        });
    });

    test("another user's row does not verify this card", () => {
        expect(verificationFrom({ u2: row }, "u1")).toEqual({ kind: "unverified" });
    });
});

const puzzle: PublicDailyPuzzle = {
    gameId: "bridges",
    number: 12,
    tier: 1,
    description: new Uint8Array([1, 2, 255]),
    startsAt: 0n,
    expiresAt: 1n,
    enabled: true,
    entryFee: 0,
    firstPlayFree: false,
    hintPrices: [],
    maxHints: 0,
    maxFreeChecks: 0,
    minCardedSolveMs: 10_000n,
};

const solved = (solveTimeMs: bigint): DailyPuzzleSolved => ({
    solvedAt: 5n,
    solveTimeMs,
    reward: 100,
    hintsUsed: 1,
    streak: 3,
});

const userState = (solve?: DailyPuzzleSolved): DailyPuzzleUserState => ({
    gameId: "bridges",
    number: 12,
    hints: [],
    grid: new Uint8Array(),
    solved: solve,
    submits: 0,
    freeChecks: 0,
    streak: 3,
    hasSolvedBefore: false,
    entryFee: 0,
});

const card = (over: Partial<DailyResultContent> = {}): DailyResultContent => ({
    kind: "daily_result",
    gameId: "bridges",
    number: 12,
    userId: "u1",
    solveTimeMs: 61_000,
    hintsUsed: 1,
    streak: 3,
    layout: "0102ff",
    tier: 1,
    ...over,
});

describe("a result card from a solve", () => {
    test("is the puzzle's, with the solve's numbers and the layout as hex", () => {
        expect(resultCard(puzzle, userState(solved(61_000n)), "u1")).toEqual(card());
    });

    test("is none until it's solved", () => {
        expect(resultCard(puzzle, userState(), "u1")).toBeUndefined();
        expect(resultCard(puzzle, undefined, "u1")).toBeUndefined();
    });
});

describe("sharing a result (#10236)", () => {
    test("is offered once the solve took at least the puzzle's minCardedSolveMs", () => {
        expect(canShareResult(puzzle, solved(10_000n))).toBe(true);
        expect(canShareResult(puzzle, solved(9_999n))).toBe(false);
        expect(canShareResult(puzzle, undefined)).toBe(false);
    });

    test("shares the store's solve of today's game, or nothing", () => {
        const state = (solve?: DailyPuzzleSolved): DailyPuzzleState => ({
            puzzles: [puzzle],
            states: [userState(solve)],
        });
        expect(shareableResultCard(state(solved(61_000n)), "bridges", "u1")).toEqual(card());
        expect(shareableResultCard(state(solved(1_000n)), "bridges", "u1")).toBeUndefined();
        expect(shareableResultCard(state(), "bridges", "u1")).toBeUndefined();
        expect(shareableResultCard(state(solved(61_000n)), "tents", "u1")).toBeUndefined();
    });
});

describe("a result card's Play", () => {
    const state = (
        over: Partial<PublicDailyPuzzle>,
        solve?: DailyPuzzleSolved,
    ): DailyPuzzleState => ({
        puzzles: [{ ...puzzle, ...over }],
        states: [userState(solve)],
    });

    test("is offered on today's puzzle the reader hasn't solved", () => {
        expect(cardOffersPlay(state({}), card())).toBe(true);
    });

    test("isn't once the reader has solved it", () => {
        expect(cardOffersPlay(state({}, solved(61_000n)), card())).toBe(false);
    });

    test("isn't offered in the new UIs while CHIT is turned off (#10605 review)", () => {
        expect(cardOffersPlayWith(state({}), card(), false)).toBe(true);
        expect(cardOffersPlayWith(state({}), card(), true)).toBe(false);
        expect(cardOffersPlayWith(state({}, solved(61_000n)), card(), false)).toBe(false);
    });

    test("isn't for another day's puzzle, or one that's off", () => {
        expect(cardOffersPlay(state({ number: 13 }), card())).toBe(false);
        expect(cardOffersPlay(state({ enabled: false }), card())).toBe(false);
        expect(cardOffersPlay({ puzzles: [], states: [] }, card())).toBe(false);
    });
});
