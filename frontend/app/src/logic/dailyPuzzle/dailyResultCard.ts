import {
    descriptionToHex,
    stateFor,
    todaysPuzzle,
    type DailyPuzzleResult,
    type DailyPuzzleSolved,
    type DailyPuzzleState,
    type DailyPuzzleUserState,
    type DailyResultContent,
    type PublicDailyPuzzle,
} from "@client";

// A solved daily puzzle's result card (`DailyResultContent`), shared into a chat, for every tree:
// making one from a solve, whether it may be shared, what the card shows (checked against the
// daily canister's results index) and whether it offers today's puzzle to play.

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

/**
 * Whether a card offers today's puzzle to play: it's for today's puzzle of its game (still on),
 * and the reader hasn't solved that game today.
 */
export function cardOffersPlay(state: DailyPuzzleState, content: DailyResultContent): boolean {
    const puzzle = todaysPuzzle(state, content.gameId);
    const isCurrent = puzzle?.enabled === true && puzzle.number === content.number;
    return isCurrent && stateFor(state, content.gameId)?.solved === undefined;
}

/** The card for a solve of `puzzle` by `userId`; none until it's solved. */
export function resultCard(
    puzzle: PublicDailyPuzzle,
    userState: DailyPuzzleUserState | undefined,
    userId: string,
): DailyResultContent | undefined {
    const solved = userState?.solved;
    if (solved === undefined) return undefined;
    return {
        kind: "daily_result",
        gameId: puzzle.gameId,
        number: puzzle.number,
        userId,
        solveTimeMs: Number(solved.solveTimeMs),
        hintsUsed: solved.hintsUsed,
        streak: solved.streak,
        layout: descriptionToHex(puzzle.description),
        tier: puzzle.tier,
    };
}

/**
 * Whether a solve may be shared as a card: a solve quicker than the puzzle's `minCardedSolveMs`
 * may not (the daily canister keeps no results row for it, so its card could never be verified).
 */
export function canShareResult(
    puzzle: Pick<PublicDailyPuzzle, "minCardedSolveMs">,
    solved: DailyPuzzleSolved | undefined,
): boolean {
    return solved !== undefined && solved.solveTimeMs >= puzzle.minCardedSolveMs;
}

/**
 * The card the reader can share for today's `gameId` from what the store holds: none while it's
 * unsolved, or solved too quickly to share (`canShareResult`).
 */
export function shareableResultCard(
    state: DailyPuzzleState,
    gameId: string,
    userId: string,
): DailyResultContent | undefined {
    const puzzle = todaysPuzzle(state, gameId);
    if (puzzle === undefined) return undefined;
    const userState = stateFor(state, gameId);
    if (!canShareResult(puzzle, userState?.solved)) return undefined;
    return resultCard(puzzle, userState, userId);
}
