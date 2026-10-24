import type { DailyPuzzleRow, ResourceKey } from "@client";
import type ChitDialog from "@openchat/ui/src/features/components/ChitDialog.svelte";
import { i18nKey } from "@src/i18n/i18n";
import {
    formatSolveTime,
    gameNameKey,
    type HintButton,
} from "@src/logic/dailyPuzzle/dailyPuzzle.svelte";
import type { ComponentProps } from "svelte";
import type { LinkedDialog } from "../app/dialogs";

// The daily puzzle's props for ChitDialog's card and the puzzle dialog's hint button, from today's
// rota (dailyPuzzleRows) and the puzzle flow (logic/dailyPuzzle).

export type PuzzleCardProps = Pick<
    ComponentProps<typeof ChitDialog>,
    "puzzleState" | "puzzleSub" | "puzzleTitle"
> & {
    // the game its "How to play" opens, if any
    gameId?: string;
    // what pressing the card opens: the puzzle, or once all are solved the leaderboard; nothing
    // without a puzzle today
    opens?: LinkedDialog;
};

/**
 * ChitDialog's puzzle card: the first puzzle on today's rota not yet solved (to play, or to go on
 * with), or, once all are, the last solved, which opens the leaderboard. Without a puzzle today it
 * still shows, saying so, with nothing to press. Text is given translated (`translate`), as the
 * card takes text.
 */
export function puzzleCardProps(
    rows: DailyPuzzleRow[],
    translate: (key: ResourceKey) => string,
): PuzzleCardProps {
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
        gameId: done.puzzle.gameId,
        opens: { kind: "leaderboard" },
    };
}

/** The hint button's label, in parts joined with " · ", as the old puzzle screens write it. */
export function hintButtonKeys(button: HintButton): ResourceKey[] {
    switch (button.kind) {
        case "mistake":
            return [i18nKey("dailyPuzzle.fixMistakeFirst")];
        case "noneLeft":
            return [i18nKey("dailyPuzzle.noHintsLeft")];
        case "hint":
            return [
                i18nKey("dailyPuzzle.hintCost", { price: button.price }),
                ...(button.hintsLeft > 0
                    ? [i18nKey("dailyPuzzle.hintsLeft", { count: button.hintsLeft })]
                    : []),
                ...(button.checksLeft !== undefined
                    ? [i18nKey("dailyPuzzle.checksLeft", { count: button.checksLeft })]
                    : []),
            ];
    }
}
