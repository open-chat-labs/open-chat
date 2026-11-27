import {
    formatTimeRemaining,
    type DailyPuzzleRow,
    type DailyResultContent,
    type PublicDailyPuzzle,
    type ResourceKey,
} from "@client";
import { i18nKey } from "@src/i18n/i18n";
import { formatSolveTime, gameNameKey, tierKey } from "./dailyPuzzle.svelte";

// Today's puzzle as the web's CHIT dialog's card (ChitDialog) and the native CHIT screen's puzzle
// row show it, from today's rota (playableDailyPuzzleRows); the puzzle's title; and what the chat
// picker says it's sharing. Moved from the web's puzzle adapter for the native tree (N11).

/** What the puzzle card opens: a puzzle (the web's ?chit=puzzle), or the leaderboard (?hof). */
export type PuzzleCardOpens = { kind: "puzzle"; gameId: string } | { kind: "leaderboard" };

/** The card's props, as ChitDialog takes them (its puzzle card's). */
export type PuzzleCardProps = {
    puzzleState: "new" | "progress" | "solved" | "unavailable" | "off";
    puzzleSub?: string;
    puzzleTitle?: string;
    puzzleCountdown?: string;
    // the game its "How to play" opens, if any
    gameId?: string;
    // what pressing the card opens: the puzzle, or once all are solved the leaderboard; nothing
    // without a puzzle today
    opens?: PuzzleCardOpens;
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

/**
 * The native puzzle screen's header (the prototype's): the puzzle's number over its game and
 * tier ("The Daily #12" over "Bridges · Easy"); while its tutorial shows, "How Bridges works"
 * over the number, or over "Step 2 of 6" where the screen steps through the demo (`step`). Before
 * the puzzle is known, "The Daily" alone. Given translated (`translate`).
 */
export function puzzleHeading(
    puzzle: PublicDailyPuzzle | undefined,
    tutorial: boolean,
    translate: (key: ResourceKey) => string,
    step?: { index: number; count: number },
): { title: string; sub: string | undefined } {
    if (puzzle === undefined) {
        return { title: translate(i18nKey("dailyPuzzle.title")), sub: undefined };
    }
    const number = translate(i18nKey("dailyPuzzle.number", { number: puzzle.number }));
    const game = translate(i18nKey(gameNameKey(puzzle.gameId)));
    if (tutorial) {
        const title = translate(i18nKey("dailyPuzzle.howGameWorks", { game }));
        // the demo's step, where the screen steps through it (native), else the puzzle's number
        const sub =
            step === undefined
                ? number
                : translate(
                      i18nKey("dailyPuzzle.demoStep", { step: step.index + 1, count: step.count }),
                  );
        return { title, sub };
    }
    return { title: number, sub: `${game} · ${translate(i18nKey(tierKey(puzzle.tier)))}` };
}

/**
 * What the chat picker shows it's sharing for a result card (#10236): the puzzle's number, then
 * its game, its tier and the solve's time. Given translated (`translate`).
 */
export function shareItem(
    card: DailyResultContent,
    translate: (key: ResourceKey) => string,
): { title: string; sub: string; icon: string } {
    return {
        title: translate(i18nKey("dailyPuzzle.number", { number: card.number })),
        sub: [
            translate(i18nKey(gameNameKey(card.gameId))),
            ...(card.tier === undefined ? [] : [translate(i18nKey(tierKey(card.tier)))]),
            formatSolveTime(card.solveTimeMs),
        ].join(" · "),
        icon: "trophy",
    };
}
