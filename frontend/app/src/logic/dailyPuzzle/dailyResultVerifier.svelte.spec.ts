import type { DailyPuzzleResult, DailyResultContent } from "@client";
import { describe, expect, test, vi } from "vitest";
import { DailyResultVerifier } from "./dailyResultVerifier.svelte";

const card = (userId: string): DailyResultContent => ({
    kind: "daily_result",
    gameId: "bridges",
    number: 12,
    userId,
    solveTimeMs: 1,
    hintsUsed: 0,
    streak: 1,
    layout: "",
});

const row: DailyPuzzleResult = {
    gameId: "bridges",
    number: 12,
    userId: "u1",
    solveTimeMs: 61_000n,
    hintsUsed: 2,
    streak: 7,
    solvedAt: 1n,
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("checking result cards against the results index", () => {
    test("is pending until the index answers, then says what it held", async () => {
        const verifyDailyResults = vi.fn(async () => ({ u1: row }));
        const verifier = new DailyResultVerifier({ verifyDailyResults });
        expect(verifier.verification(card("u1"))).toEqual({ kind: "pending" });
        expect(verifier.verification(card("u2"))).toEqual({ kind: "pending" });
        await settle();
        expect(verifier.verification(card("u1"))).toEqual({ kind: "verified", row });
        expect(verifier.verification(card("u2"))).toEqual({ kind: "unverified" });
    });

    test("asks about each card once, however often it's shown", async () => {
        const verifyDailyResults = vi.fn(async () => ({}));
        const verifier = new DailyResultVerifier({ verifyDailyResults });
        verifier.verification(card("u1"));
        verifier.verification(card("u1"));
        await settle();
        verifier.verification(card("u1"));
        expect(verifyDailyResults).toHaveBeenCalledTimes(1);
        expect(verifyDailyResults).toHaveBeenCalledWith("bridges", 12, ["u1"]);
    });

    test("asks again the next time it's shown when the check failed", async () => {
        const verifyDailyResults = vi
            .fn<() => Promise<Record<string, DailyPuzzleResult>>>()
            .mockRejectedValueOnce(new Error("offline"))
            .mockResolvedValue({ u1: row });
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const verifier = new DailyResultVerifier({ verifyDailyResults });
        verifier.verification(card("u1"));
        await settle();
        expect(verifier.verification(card("u1"))).toEqual({ kind: "pending" });
        await settle();
        expect(verifier.verification(card("u1"))).toEqual({ kind: "verified", row });
        warn.mockRestore();
    });
});
