import type { DailyPuzzleRow, DailyPuzzleStatus, PublicDailyPuzzle, ResourceKey } from "@client";
import { puzzleCardProps, puzzleTitle } from "./puzzle.adapter";

const NOW = 1_000_000_000;

const puzzle = (gameId: string): PublicDailyPuzzle => ({
    gameId,
    number: 7,
    tier: 0,
    description: new Uint8Array(),
    startsAt: 0n,
    expiresAt: BigInt(NOW + 61 * 60_000 + 5000),
    enabled: true,
    entryFee: 0,
    firstPlayFree: false,
    hintPrices: [],
    maxHints: 0,
    maxFreeChecks: 0,
    minCardedSolveMs: 0n,
});

const row = (gameId: string, status: DailyPuzzleStatus, solveTimeMs?: bigint): DailyPuzzleRow => ({
    puzzle: puzzle(gameId),
    status,
    state:
        status === "play"
            ? undefined
            : {
                  gameId,
                  number: 7,
                  startedAt: 1n,
                  hints: [],
                  grid: new Uint8Array(),
                  submits: 0,
                  freeChecks: 0,
                  streak: 1,
                  hasSolvedBefore: false,
                  entryFee: 0,
                  solved:
                      solveTimeMs === undefined
                          ? undefined
                          : { solvedAt: 1n, solveTimeMs, reward: 0, hintsUsed: 0, streak: 1 },
              },
});

// the key as text, its params after it
const translate = ({ key, params }: ResourceKey) =>
    params === undefined ? key : `${key}${JSON.stringify(params)}`;

describe("the CHIT dialog's puzzle card", () => {
    test("is off while today's puzzles are still loading, rather than saying there's none", () => {
        expect(puzzleCardProps(undefined, NOW, translate)).toEqual({ puzzleState: "off" });
    });

    test("without a puzzle today still shows, saying so, and opens nothing", () => {
        expect(puzzleCardProps([], NOW, translate)).toEqual({
            puzzleState: "unavailable",
            puzzleTitle: "dailyPuzzle.todaysPuzzle",
        });
    });

    test("opens the first puzzle not solved, to play or to go on with, naming its game", () => {
        expect(
            puzzleCardProps(
                [row("bridges", "solved", 1000n), row("tents", "play")],
                NOW,
                translate,
            ),
        ).toEqual({
            puzzleState: "new",
            puzzleTitle: "dailyPuzzle.todaysPuzzle · dailyPuzzle.games.tents.name",
            gameId: "tents",
            opens: { kind: "puzzle", gameId: "tents" },
        });
        expect(puzzleCardProps([row("slant", "continue")], NOW, translate)).toMatchObject({
            puzzleState: "progress",
            opens: { kind: "puzzle", gameId: "slant" },
        });
    });

    test("once all are solved, shows the last one solved and its time, and opens the leaderboard", () => {
        expect(puzzleCardProps([row("loopy", "solved", 252_000n)], NOW, translate)).toEqual({
            puzzleState: "solved",
            puzzleSub: "dailyPuzzle.solved · 4:12",
            // the puzzle's own end, not the CHIT claim's
            puzzleCountdown: "01:01:05",
            gameId: "loopy",
            opens: { kind: "leaderboard" },
        });
    });

    test("a solved puzzle past its end counts down to 0, never a negative time", () => {
        const later = NOW + 2 * 60 * 60_000;
        expect(
            puzzleCardProps([row("loopy", "solved", 1000n)], later, translate).puzzleCountdown,
        ).toBe("00:00:00");
    });
});

describe("the puzzle dialog's title", () => {
    test("is the puzzle's number, game and tier, or The Daily with none", () => {
        expect(puzzleTitle(puzzle("tents"), translate)).toBe(
            'dailyPuzzle.number{"number":7} · dailyPuzzle.games.tents.name · dailyPuzzle.tier.0',
        );
        expect(puzzleTitle(undefined, translate)).toBe("dailyPuzzle.title");
    });
});
