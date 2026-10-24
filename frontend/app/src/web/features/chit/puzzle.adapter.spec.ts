import type { DailyPuzzleRow, DailyPuzzleStatus, PublicDailyPuzzle, ResourceKey } from "@client";
import { hintButtonKeys, puzzleCardProps } from "./puzzle.adapter";

const puzzle = (gameId: string): PublicDailyPuzzle => ({
    gameId,
    number: 7,
    tier: 0,
    description: new Uint8Array(),
    startsAt: 0n,
    expiresAt: 0n,
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
    test("is off without a puzzle today", () => {
        expect(puzzleCardProps([], translate)).toEqual({ puzzleState: "off" });
    });

    test("opens the first puzzle not solved, to play or to go on with, naming its game", () => {
        expect(
            puzzleCardProps([row("bridges", "solved", 1000n), row("tents", "play")], translate),
        ).toEqual({
            puzzleState: "new",
            puzzleTitle: "dailyPuzzle.todaysPuzzle · dailyPuzzle.games.tents.name",
            gameId: "tents",
        });
        expect(puzzleCardProps([row("slant", "continue")], translate)).toMatchObject({
            puzzleState: "progress",
            gameId: "slant",
        });
    });

    test("once all are solved, shows the last one solved and its time", () => {
        expect(puzzleCardProps([row("loopy", "solved", 252_000n)], translate)).toEqual({
            puzzleState: "solved",
            puzzleSub: "dailyPuzzle.solved · 4:12",
            gameId: "loopy",
        });
    });
});

describe("the puzzle dialog's hint button", () => {
    test("says why there's no hint, or what one costs and what's left", () => {
        expect(hintButtonKeys({ kind: "mistake" }).map((k) => k.key)).toEqual([
            "dailyPuzzle.fixMistakeFirst",
        ]);
        expect(hintButtonKeys({ kind: "noneLeft" }).map((k) => k.key)).toEqual([
            "dailyPuzzle.noHintsLeft",
        ]);
        expect(
            hintButtonKeys({ kind: "hint", price: 50, hintsLeft: 2, checksLeft: 3 }).map(translate),
        ).toEqual([
            'dailyPuzzle.hintCost{"price":50}',
            'dailyPuzzle.hintsLeft{"count":2}',
            'dailyPuzzle.checksLeft{"count":3}',
        ]);
        expect(hintButtonKeys({ kind: "hint", price: 50, hintsLeft: 0 }).map((k) => k.key)).toEqual(
            ["dailyPuzzle.hintCost"],
        );
    });
});
