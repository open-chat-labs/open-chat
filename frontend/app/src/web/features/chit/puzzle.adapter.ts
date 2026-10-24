import {
    formatTimeRemaining,
    type DailyPuzzleRow,
    type PublicDailyPuzzle,
    type ResourceKey,
} from "@client";
import type ChitDialog from "@openchat/ui/src/features/components/ChitDialog.svelte";
import { i18nKey } from "@src/i18n/i18n";
import { formatSolveTime, gameNameKey, tierKey } from "@src/logic/dailyPuzzle/dailyPuzzle.svelte";
import type { ComponentProps } from "svelte";
import type { LinkedDialog } from "../app/dialogs";

// The daily puzzle's props for ChitDialog's card, from today's rota (playableDailyPuzzleRows), and
// the puzzle dialog's title.

export type PuzzleCardProps = Pick<
    ComponentProps<typeof ChitDialog>,
    "puzzleState" | "puzzleSub" | "puzzleTitle" | "puzzleCountdown"
> & {
    // the game its "How to play" opens, if any
    gameId?: string;
    // what pressing the card opens: the puzzle, or once all are solved the leaderboard; nothing
    // without a puzzle today
    opens?: LinkedDialog;
};

/**
 * ChitDialog's puzzle card: the first puzzle on today's rota not yet solved (to play, or to go on
 * with), or, once all are, the last solved, which opens the leaderboard and counts down to when it
 * ends (`now`, ms). Without a puzzle today it still shows, saying so, with nothing to press; none
 * while today's are still loading (`rows` undefined). Text is given translated (`translate`), as
 * the card takes text.
 */
export function puzzleCardProps(
    rows: DailyPuzzleRow[] | undefined,
    now: number,
    translate: (key: ResourceKey) => string,
): PuzzleCardProps {
    if (rows === undefined) return { puzzleState: "off" };
    if (rows.length === 0) {
        return {
            puzzleState: "unavailable",
            puzzleTitle: translate(i18nKey("dailyPuzzle.todaysPuzzle")),
        };
    }
    const open = rows.find((r) => r.status !== "solved");
    if (open !== undefined) {
        return {
            puzzleState: open.status === "continue" ? "progress" : "new",
            puzzleTitle: `${translate(i18nKey("dailyPuzzle.todaysPuzzle"))} · ${translate(
                i18nKey(gameNameKey(open.puzzle.gameId)),
            )}`,
            gameId: open.puzzle.gameId,
            opens: { kind: "puzzle", gameId: open.puzzle.gameId },
        };
    }
    const done = rows[rows.length - 1];
    const time = done.state?.solved?.solveTimeMs;
    return {
        puzzleState: "solved",
        puzzleSub:
            time === undefined
                ? undefined
                : `${translate(i18nKey("dailyPuzzle.solved"))} · ${formatSolveTime(Number(time))}`,
        // the next puzzle comes out as this one ends; never a negative time while the store still
        // holds it after its end (till the rollover fetch lands)
        puzzleCountdown: formatTimeRemaining(
            now,
            Math.max(now, Number(done.puzzle.expiresAt)),
            true,
        ),
        gameId: done.puzzle.gameId,
        opens: { kind: "leaderboard" },
    };
}

/**
 * The puzzle dialog's title: the puzzle's number, game and tier, as the old puzzle screens head
 * it, or "The Daily" with no puzzle. Given translated (`translate`).
 */
export function puzzleTitle(
    puzzle: PublicDailyPuzzle | undefined,
    translate: (key: ResourceKey) => string,
): string {
    if (puzzle === undefined) return translate(i18nKey("dailyPuzzle.title"));
    return [
        translate(i18nKey("dailyPuzzle.number", { number: puzzle.number })),
        translate(i18nKey(gameNameKey(puzzle.gameId))),
        translate(i18nKey(tierKey(puzzle.tier))),
    ].join(" · ");
}
