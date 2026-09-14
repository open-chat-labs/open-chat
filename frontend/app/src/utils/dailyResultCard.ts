import type { DailyPuzzleResult } from "@client";

export type CardVerification =
    | { kind: "pending" }
    | { kind: "unverified" }
    | { kind: "verified"; row: DailyPuzzleResult };

export type CardNumbers = { solveTimeMs: number; hintsUsed: number; streak: number };

/** What the daily canister's results index said about this card, once asked. */
export function verificationFrom(
    rows: Record<string, DailyPuzzleResult>,
    userId: string,
): CardVerification {
    const row = rows[userId];
    return row === undefined ? { kind: "unverified" } : { kind: "verified", row };
}

/**
 * #9332 invariant 44. The numbers a result card shows come from the results index row and
 * from nowhere else: the card's own payload is a claim, and is deliberately not an input here.
 * No row, no numbers.
 */
export function cardNumbers(verification: CardVerification): CardNumbers | undefined {
    if (verification.kind !== "verified") return undefined;
    const { solveTimeMs, hintsUsed, streak } = verification.row;
    return { solveTimeMs: Number(solveTimeMs), hintsUsed, streak };
}
