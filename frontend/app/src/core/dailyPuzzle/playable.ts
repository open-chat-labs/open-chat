import {
    bridges,
    chatRooms,
    dailyPuzzleRows,
    lightUp,
    loopy,
    slant,
    tents,
    unruly,
    type DailyPuzzleRow,
    type DailyPuzzleState,
} from "@client";

// Which of today's puzzles this build can draw, without loading the boards (registry.ts), for the
// app's shell (the rail's puzzle dot) as much as the CHIT dialog.

/** The games registry.ts has a board for (its spec keeps the two the same). */
export const DRAWN_GAMES: ReadonlySet<string> = new Set(
    [bridges, chatRooms, lightUp, loopy, slant, tents, unruly].map((g) => g.id),
);

/**
 * Today's puzzles this build can draw, one row each (dailyPuzzleRows), or undefined until the first
 * fetch has come back, so "none today" isn't said while they're still loading.
 */
export function playableDailyPuzzleRows(state: DailyPuzzleState): DailyPuzzleRow[] | undefined {
    if (state.lastFetched === undefined) return undefined;
    return dailyPuzzleRows(state).filter((r) => DRAWN_GAMES.has(r.puzzle.gameId));
}
