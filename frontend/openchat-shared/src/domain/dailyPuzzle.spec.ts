import { describe, expect, test } from "vitest";
import { parseDailyPuzzleChitKey, puzzleFingerprint } from "./dailyPuzzle";

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
    test("parses an entry key", () => {
        expect(parseDailyPuzzleChitKey("20706:entry")).toEqual({ number: 20706, kind: "entry" });
    });

    test("parses a solve key", () => {
        expect(parseDailyPuzzleChitKey("20706:solve")).toEqual({ number: 20706, kind: "solve" });
    });

    test("parses a hint key", () => {
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
