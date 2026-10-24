import { describe, expect, test } from "vitest";
import {
    dailyPuzzleRows,
    dailyPuzzleStatusKey,
    parseDailyPuzzleChitKey,
    puzzleFingerprint,
    puzzleReplaced,
    rolloverDelay,
    ROLLOVER_GRACE_MS,
    type DailyPuzzleSolved,
    type DailyPuzzleUserState,
    type PublicDailyPuzzle,
} from "./dailyPuzzle";

function puzzle(gameId: string, number: number, description: number[]) {
    return { gameId, number, description: new Uint8Array(description) };
}

describe("puzzleFingerprint", () => {
    test("same game, number and description bytes match", () => {
        const a = puzzle("light_up", 20705, [1, 3, 3, 0, 0x10, 0, 0x12, 0, 0, 0, 0, 0]);
        const b = puzzle("light_up", 20705, [1, 3, 3, 0, 0x10, 0, 0x12, 0, 0, 0, 0, 0]);
        expect(puzzleFingerprint(a)).toBe(puzzleFingerprint(b));
    });

    test("a regenerated layout with the same number does not match", () => {
        const a = puzzle("light_up", 20705, [1, 3, 3, 0, 0x10, 0, 0x12, 0, 0, 0, 0, 0]);
        const b = puzzle("light_up", 20705, [1, 3, 3, 0, 0x10, 0, 0x11, 0, 0, 0, 0, 0]);
        expect(puzzleFingerprint(a)).not.toBe(puzzleFingerprint(b));
    });

    test("a different number or game does not match", () => {
        const bytes = [1, 3, 3, 0, 0x10, 0, 0x12, 0, 0, 0, 0, 0];
        const a = puzzleFingerprint(puzzle("light_up", 20705, bytes));
        expect(puzzleFingerprint(puzzle("light_up", 20706, bytes))).not.toBe(a);
        expect(puzzleFingerprint(puzzle("other", 20705, bytes))).not.toBe(a);
    });

    test("is FNV-1a 32-bit over the bytes", () => {
        // FNV-1a of "a" is 0xe40c292c
        expect(puzzleFingerprint(puzzle("g", 1, [0x61]))).toBe("g:1:e40c292c");
        expect(puzzleFingerprint(puzzle("g", 1, []))).toBe("g:1:811c9dc5");
    });
});

describe("parseDailyPuzzleChitKey", () => {
    // #9332 invariant 49. These are the shapes the local user index mints, as its test
    // `chit_keys_do_not_identify_the_puzzle` asserts them: entry and solve name the day only,
    // hints name the game, step and level.
    test("parses entry, solve and hint keys", () => {
        expect(parseDailyPuzzleChitKey("20706:entry")).toEqual({ number: 20706, kind: "entry" });
        expect(parseDailyPuzzleChitKey("20706:solve")).toEqual({ number: 20706, kind: "solve" });
        expect(parseDailyPuzzleChitKey("light_up:20706:hint:12:3")).toEqual({
            gameId: "light_up",
            number: 20706,
            kind: "hint",
        });
    });

    test("rejects malformed keys", () => {
        expect(parseDailyPuzzleChitKey("light_up")).toBeUndefined();
        expect(parseDailyPuzzleChitKey("abc:solve")).toBeUndefined();
        expect(parseDailyPuzzleChitKey("20706:bogus")).toBeUndefined();
        expect(parseDailyPuzzleChitKey("light_up:20706:solve")).toBeUndefined();
        expect(parseDailyPuzzleChitKey("light_up:20706:hint")).toBeUndefined();
        expect(parseDailyPuzzleChitKey("light_up:abc:hint:1:1")).toBeUndefined();
    });
});

function publicPuzzle(over: Partial<PublicDailyPuzzle> = {}): PublicDailyPuzzle {
    return {
        gameId: "light_up",
        number: 20706,
        tier: 0,
        description: new Uint8Array([1, 3, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
        startsAt: 1_000n,
        expiresAt: 10_000n,
        enabled: true,
        entryFee: 100,
        firstPlayFree: true,
        hintPrices: [25, 75, 200],
        maxHints: 3,
        maxFreeChecks: 20,
        minCardedSolveMs: 0n,
        ...over,
    };
}

describe("rollover refetch timing (#9334 invariant 57)", () => {
    test("is the earliest enabled expiry plus a grace", () => {
        const state = {
            puzzles: [
                publicPuzzle({ expiresAt: 10_000n }),
                publicPuzzle({ gameId: "tents", expiresAt: 8_000n }),
            ],
            states: [],
        };
        expect(rolloverDelay(state, 2_000)).toBe(6_000 + ROLLOVER_GRACE_MS);
    });

    test("ignores disabled puzzles and is undefined with nothing enabled", () => {
        expect(
            rolloverDelay({ puzzles: [publicPuzzle({ enabled: false })], states: [] }, 0),
        ).toBeUndefined();
        expect(rolloverDelay({ puzzles: [], states: [] }, 0)).toBeUndefined();
    });

    test("an already expired puzzle asks for a refetch now, not in the past", () => {
        expect(
            rolloverDelay({ puzzles: [publicPuzzle({ expiresAt: 10_000n })], states: [] }, 50_000),
        ).toBe(ROLLOVER_GRACE_MS);
    });
});

describe("puzzle replacement (#9334 invariant 58)", () => {
    test("a new number or a new layout under the same number is a replacement", () => {
        expect(puzzleReplaced(publicPuzzle(), publicPuzzle({ number: 20707 }))).toBe(true);
        expect(
            puzzleReplaced(
                publicPuzzle(),
                publicPuzzle({
                    description: new Uint8Array([1, 3, 3, 0, 0, 0, 0, 0x10, 0, 0, 0, 0]),
                }),
            ),
        ).toBe(true);
    });

    test("the same puzzle with different user-facing config is not", () => {
        expect(puzzleReplaced(publicPuzzle(), publicPuzzle({ entryFee: 0, enabled: false }))).toBe(
            false,
        );
    });
});

describe("today's puzzle rows", () => {
    const pub = (gameId: string, enabled = true): PublicDailyPuzzle => ({
        gameId,
        number: 1,
        tier: 0,
        description: new Uint8Array(),
        startsAt: 0n,
        expiresAt: 0n,
        enabled,
        entryFee: 0,
        firstPlayFree: false,
        hintPrices: [],
        maxHints: 0,
        maxFreeChecks: 0,
        minCardedSolveMs: 0n,
    });
    const solved = (): DailyPuzzleSolved => ({
        solvedAt: 1n,
        solveTimeMs: 1n,
        reward: 0,
        hintsUsed: 0,
        streak: 1,
    });
    const user = (gameId: string, extra: Partial<DailyPuzzleUserState>): DailyPuzzleUserState => ({
        gameId,
        number: 1,
        hints: [],
        grid: new Uint8Array(),
        submits: 0,
        freeChecks: 0,
        streak: 0,
        hasSolvedBefore: false,
        entryFee: 0,
        ...extra,
    });

    test("are the enabled puzzles, each with the user's state and where they are with it", () => {
        const rows = dailyPuzzleRows({
            puzzles: [pub("bridges"), pub("tents", false), pub("slant"), pub("loopy")],
            states: [
                user("slant", { startedAt: 5n }),
                user("loopy", { startedAt: 5n, solved: solved() }),
            ],
        });
        expect(rows.map((r) => [r.puzzle.gameId, r.status])).toEqual([
            ["bridges", "play"],
            ["slant", "continue"],
            ["loopy", "solved"],
        ]);
        expect(rows.map((r) => dailyPuzzleStatusKey(r.status))).toEqual([
            "dailyPuzzle.play",
            "dailyPuzzle.continue",
            "dailyPuzzle.solved",
        ]);
    });
});
