import {
    dailyPuzzleStore,
    puzzleFingerprint,
    type DailyPuzzleUserState,
    type OpenChat,
    type PublicDailyPuzzle,
    type ServedHint,
} from "@client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { toastStore } from "../stores/toast";
import { DailyPuzzleGame } from "./dailyPuzzle.svelte";
import { dailyPuzzleGame } from "./dailyPuzzleGames";

const NUMBER = 20706;
const USER = "user1";

// Light Up, 3x3, every cell white. Bulbs on the diagonal (0, 4, 8) light every cell and none of
// them sees another, so that is the one solution.
const puzzle: PublicDailyPuzzle = {
    gameId: "light_up",
    number: NUMBER,
    tier: 0,
    description: new Uint8Array([1, 3, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    startsAt: 0n,
    expiresAt: 0n,
    enabled: true,
    entryFee: 100,
    firstPlayFree: true,
    hintPrices: [25, 75, 200],
    maxHints: 3,
    maxFreeChecks: 2,
    minCardedSolveMs: 0n,
};

function userState(overrides: Partial<DailyPuzzleUserState> = {}): DailyPuzzleUserState {
    return {
        gameId: "light_up",
        number: NUMBER,
        startedAt: 1n,
        hints: [],
        grid: new Uint8Array(0),
        submits: 0,
        freeChecks: 2,
        streak: 0,
        hasSolvedBefore: false,
        entryFee: 0,
        ...overrides,
    };
}

const game = dailyPuzzleGame("light_up")!.game;
const model = game.parse(puzzle.description);

type Fake = {
    dailyPuzzleStart: ReturnType<typeof vi.fn>;
    dailyPuzzleSubmit: ReturnType<typeof vi.fn>;
    dailyPuzzleHint: ReturnType<typeof vi.fn>;
    dailyPuzzleSaveGrid: ReturnType<typeof vi.fn>;
};

function fakeClient(overrides: Partial<Fake> = {}): OpenChat & Fake {
    const fake: Fake = {
        dailyPuzzleStart: vi.fn(async () => ({
            kind: "success",
            startedAt: 1n,
            state: userState(),
        })),
        dailyPuzzleSubmit: vi.fn(async () => ({
            kind: "success",
            solved: { solvedAt: 2n, solveTimeMs: 1n, reward: 250, hintsUsed: 0, streak: 1 },
        })),
        dailyPuzzleHint: vi.fn(),
        dailyPuzzleSaveGrid: vi.fn(async () => true),
        ...overrides,
    };
    return fake as unknown as OpenChat & Fake;
}

function build(state: DailyPuzzleUserState | undefined, client = fakeClient()): DailyPuzzleGame {
    dailyPuzzleStore.set({ puzzles: [puzzle], states: state === undefined ? [] : [state] });
    return new DailyPuzzleGame(client, puzzle, state, USER, game);
}

function saveLocal(savedAt: number, fingerprint = puzzleFingerprint(puzzle)): void {
    localStorage.setItem(
        `daily_puzzle_${USER}_${NUMBER}`,
        JSON.stringify({ filled: [[0, 1]], savedAt, fingerprint }),
    );
}

beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(toastStore, "showFailureToast").mockImplementation(() => {});
});

describe("DailyPuzzleGame", () => {
    // #9332 invariant 40
    test("the entry fee is the server's quote for this user, never derived here", () => {
        // First play free and never solved, yet the server quotes 100: the client does not
        // second-guess it, the server re-checks the expected price on the start call
        expect(build(userState({ entryFee: 100 })).entryFee).toBe(100);
        expect(build(userState({ entryFee: 0, hasSolvedBefore: true })).entryFee).toBe(0);
        // Before a state exists the only quote is the config fee
        expect(build(undefined).entryFee).toBe(puzzle.entryFee);
    });

    test("start sends the quoted fee as the expected price", async () => {
        const client = fakeClient();
        const g = build(userState({ entryFee: 40 }), client);
        await g.start();
        expect(client.dailyPuzzleStart).toHaveBeenCalledWith("light_up", 40);
    });

    // #9332 invariant 39
    test("the grid submits itself only once every rule passes", async () => {
        const client = fakeClient();
        const g = build(userState(), client);
        g.tap(0);
        g.tap(4);
        expect(g.solvedLocally).toBe(false);
        expect(client.dailyPuzzleSubmit).not.toHaveBeenCalled();
        g.tap(8);
        expect(g.solvedLocally).toBe(true);
        await vi.waitFor(() => expect(client.dailyPuzzleSubmit).toHaveBeenCalledTimes(1));
    });

    test("a submit the server rejects is an error, not a game state", async () => {
        const client = fakeClient({
            dailyPuzzleSubmit: vi.fn(async () => ({ kind: "error", code: 0, message: "wrong" })),
        });
        const g = build(userState(), client);
        g.tap(0);
        g.tap(4);
        g.tap(8);
        await vi.waitFor(() => expect(toastStore.showFailureToast).toHaveBeenCalled());
        expect(g.userState?.solved).toBeUndefined();
        expect(g.inputDisabled).toBe(false);
    });

    // #9332 invariant 42
    test("resume takes the newer of the local and server grids by timestamp", () => {
        const serverGrid = game.toBytes(model, game.apply(model, game.empty(model), 4, 1));
        const server = { grid: serverGrid, gridSavedAt: 1000n };

        saveLocal(2000);
        expect([...build(userState(server)).marks.keys()]).toEqual([0]);

        saveLocal(500);
        expect([...build(userState(server)).marks.keys()]).toEqual([4]);

        // A local copy saved against another layout is not this puzzle's, however new
        saveLocal(2000, "light_up:20706:deadbeef");
        expect([...build(userState(server)).marks.keys()]).toEqual([4]);

        // Nothing is resumed before the puzzle is started
        saveLocal(2000);
        expect(build(userState({ ...server, startedAt: undefined })).marks.size).toBe(0);
    });

    // #9332 invariant 43
    test("a hint clears itself once the player has made the move it pointed at", async () => {
        const hint: ServedHint = {
            hint: { technique: 1, focus: [0, 1, 2], target: [0], conclusions: [] },
            level: 1,
            mistake: false,
        };
        const client = fakeClient({
            dailyPuzzleHint: vi.fn(async () => ({
                kind: "success",
                hint,
                hintsUsed: 1,
                state: userState({ hints: [hint] }),
            })),
        });
        const g = build(userState(), client);
        await g.hint();
        expect([...g.focus]).toEqual([0, 1, 2]);
        expect([...g.target]).toEqual([0]);

        // A mark elsewhere in the highlighted region is not the move the hint asked for
        g.tap(1);
        expect(g.focus.size).toBe(3);

        // The pointed-at cell gets its mark: acted on, so the hint goes
        g.tap(0);
        expect(g.focus.size).toBe(0);
        expect(g.target.size).toBe(0);
        expect(g.caption).toBeUndefined();
    });
});
