import { describe, expect, test } from "vitest";
import { cardNumbers, verificationFrom } from "./dailyResultCard";

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
