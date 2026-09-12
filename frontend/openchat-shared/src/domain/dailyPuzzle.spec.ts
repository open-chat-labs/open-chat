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
    test("parses keys with the puzzle fingerprint", () => {
        expect(parseDailyPuzzleChitKey("light_up:20706:deadbeef:entry")).toEqual({
            gameId: "light_up",
            number: 20706,
            fingerprint: "deadbeef",
            kind: "entry",
        });
        expect(parseDailyPuzzleChitKey("light_up:20706:deadbeef:solve")?.kind).toBe("solve");
        expect(parseDailyPuzzleChitKey("light_up:20706:deadbeef:hint:12:3")).toEqual({
            gameId: "light_up",
            number: 20706,
            fingerprint: "deadbeef",
            kind: "hint",
        });
    });

    test("still parses keys minted before the fingerprint", () => {
        expect(parseDailyPuzzleChitKey("light_up:20706:solve")).toEqual({
            gameId: "light_up",
            number: 20706,
            kind: "solve",
        });
        expect(parseDailyPuzzleChitKey("light_up:20706:hint:2:1")?.kind).toBe("hint");
    });

    test("rejects malformed keys", () => {
        expect(parseDailyPuzzleChitKey("light_up")).toBeUndefined();
        expect(parseDailyPuzzleChitKey("light_up:abc:solve")).toBeUndefined();
        expect(parseDailyPuzzleChitKey("light_up:20706:deadbeef")).toBeUndefined();
        expect(parseDailyPuzzleChitKey("light_up:20706:deadbeef:bogus")).toBeUndefined();
    });
});
