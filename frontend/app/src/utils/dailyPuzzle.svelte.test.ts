import {
    dailyPuzzleStore,
    puzzleFingerprint,
    type DailyPuzzleUserState,
    type OpenChat,
    type PublicDailyPuzzle,
    type ServedHint,
} from "@client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import en from "../i18n/en.json";
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

        // A mark elsewhere in the highlighted region is not the move the hint asked for: the
        // hint stays, and the marked cell drops out of the highlight
        g.tap(1);
        expect([...g.focus].sort()).toEqual([0, 2]);
        expect([...g.target]).toEqual([0]);

        // The pointed-at cell gets its mark: acted on, so the hint goes
        g.tap(0);
        expect(g.focus.size).toBe(0);
        expect(g.target.size).toBe(0);
        expect(g.caption).toBeUndefined();
    });

    // #9334 invariant 60
    test("an upgrade of the served step is quoted at the difference between the levels", async () => {
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
        expect(g.nextHintLevel).toBe(1);
        expect(g.nextHintPrice).toBe(25);
        await g.hint();
        expect(g.nextHintLevel).toBe(2);
        expect(g.nextHintPrice).toBe(75 - 25);
        await g.hint();
        expect(client.dailyPuzzleHint).toHaveBeenLastCalledWith(
            "light_up",
            2,
            expect.anything(),
            50,
        );
    });

    test("a price mismatch is retried once with the price the server quoted", async () => {
        const hint: ServedHint = {
            hint: { technique: 1, focus: [0], target: [0], conclusions: [] },
            level: 1,
            mistake: false,
        };
        const client = fakeClient({
            dailyPuzzleHint: vi
                .fn()
                .mockResolvedValueOnce({ kind: "error", code: 250, message: "40" })
                .mockResolvedValueOnce({
                    kind: "success",
                    hint,
                    hintsUsed: 1,
                    state: userState({ hints: [hint] }),
                }),
        });
        const g = build(userState(), client);
        await g.hint();
        expect(client.dailyPuzzleHint).toHaveBeenCalledTimes(2);
        expect(client.dailyPuzzleHint).toHaveBeenLastCalledWith(
            "light_up",
            1,
            expect.anything(),
            40,
        );
        expect(toastStore.showFailureToast).not.toHaveBeenCalled();
        expect(g.lastHint).toEqual(hint);
        expect(g.busy).toBe(false);
    });

    test("a second price mismatch is an error, not a loop", async () => {
        const client = fakeClient({
            dailyPuzzleHint: vi.fn(async () => ({ kind: "error", code: 250, message: "40" })),
        });
        const g = build(userState(), client);
        await g.hint();
        expect(client.dailyPuzzleHint).toHaveBeenCalledTimes(2);
        expect(toastStore.showFailureToast).toHaveBeenCalled();
    });

    // #9334 invariant 61. Slant #20709 step 9: the deduction looked at the four cells round the
    // 3 at vertex 48; the sentence points at the vertex, which takes no mark.
    describe("a hint highlights only what is still to do (slant)", () => {
        const hex =
            "01060601ffffffff0101ff01ff020303ffffffffffffffff00ff030101ff01ffffffff03ffff00ff0203ff01ffff01ff0002ffff";
        const slantPuzzle: PublicDailyPuzzle = {
            ...puzzle,
            gameId: "slant",
            number: 20709,
            description: Uint8Array.from(hex.match(/../g)!.map((b) => parseInt(b, 16))),
        };
        const slant = dailyPuzzleGame("slant")!.game;
        const step9: ServedHint = {
            hint: { technique: 2, focus: [48, 4, 10, 11, 5], target: [48], conclusions: [] },
            level: 2,
            mistake: false,
        };
        function buildSlant(marked: number[], client: OpenChat): DailyPuzzleGame {
            const model = slant.parse(slantPuzzle.description);
            let st = slant.empty(model);
            for (const k of marked) st = slant.tap(model, st, k);
            const grid = slant.toBytes(model, st);
            const state = userState({ gameId: "slant", number: 20709, grid, gridSavedAt: 5n });
            dailyPuzzleStore.set({ puzzles: [slantPuzzle], states: [state] });
            return new DailyPuzzleGame(client, slantPuzzle, state, USER, slant);
        }
        const hintClient = () =>
            fakeClient({
                dailyPuzzleHint: vi.fn(async () => ({
                    kind: "success",
                    hint: step9,
                    hintsUsed: 1,
                    state: userState({ gameId: "slant", number: 20709, hints: [step9] }),
                })),
            });

        test("cells already marked are not highlighted; the vertex and the empty cells are", async () => {
            const g = buildSlant([4, 5], hintClient());
            await g.hint();
            expect([...g.focus].sort()).toEqual([10, 11, 48]);
            expect([...g.target]).toEqual([48]);
        });

        test("a hint for a step the player has already done shows its sentence and clears on the next tap anywhere", async () => {
            const g = buildSlant([4, 5, 10, 11], hintClient());
            await g.hint();
            expect([...g.focus]).toEqual([48]);
            expect(g.caption).toBeDefined();
            g.tap(20);
            expect(g.focus.size).toBe(0);
            expect(g.caption).toBeUndefined();
        });

        test("a hint clears once every cell it still asked for is marked", async () => {
            const g = buildSlant([4, 5], hintClient());
            await g.hint();
            g.tap(10);
            expect(g.focus.size).toBe(2);
            g.tap(11);
            expect(g.focus.size).toBe(0);
        });
    });
});

// #9360: the hint button and caption follow the state the engine is in
describe("hint states (#9360)", () => {
    const mistake: ServedHint = {
        hint: { technique: 0, focus: [0], target: [], conclusions: [] },
        level: 1,
        mistake: true,
    };
    const step: ServedHint = {
        hint: { technique: 1, focus: [0, 1, 2], target: [0], conclusions: [] },
        level: 1,
        mistake: false,
    };
    // Answers a mistake for as long as cell 0 is marked, then serves a step
    function mistakeClient(freeChecks = 2): OpenChat & Fake {
        return fakeClient({
            dailyPuzzleHint: vi.fn(async (_g: string, _l: number, filled: [number, number][]) => {
                const wrong = filled.some(([k]) => k === 0);
                return {
                    kind: "success",
                    hint: wrong ? mistake : step,
                    hintsUsed: wrong ? 0 : 1,
                    state: userState({ hints: [wrong ? mistake : step], freeChecks }),
                };
            }),
        });
    }

    // invariant 1
    test("a second press on the same marks after a mistake makes no server call", async () => {
        const client = mistakeClient();
        const g = build(userState(), client);
        g.tap(0);
        await g.hint();
        expect(g.mistakes.has(0)).toBe(true);
        expect(g.mistakeStands).toBe(true);
        await g.hint();
        await g.hint();
        expect(client.dailyPuzzleHint).toHaveBeenCalledTimes(1);

        // Editing away hides the answer; editing back to the same marks shows it again, and
        // still asks for nothing: the server would only say the same thing
        g.tap(0);
        expect(g.mistakes.size).toBe(0);
        g.tap(0);
        g.tap(0);
        expect(game.filled(model, g.state)).toEqual([[0, 1]]);
        expect(g.mistakes.has(0)).toBe(true);
        expect(g.hintButton).toEqual({ kind: "mistake" });
        await g.hint();
        expect(client.dailyPuzzleHint).toHaveBeenCalledTimes(1);

        // A reload with the wrong mark still on the board resumes the same answer, so the first
        // press after it does not spend a free check repainting the same cell
        const again = build(userState(), client);
        expect(game.filled(model, again.state)).toEqual([[0, 1]]);
        expect(again.mistakes.has(0)).toBe(true);
        expect(again.caption).toEqual(expect.objectContaining({ key: "dailyPuzzle.mistake" }));
        expect(again.hintButton).toEqual({ kind: "mistake" });
        await again.hint();
        expect(client.dailyPuzzleHint).toHaveBeenCalledTimes(1);
    });

    // invariant 1, the plain reload: no edit between the mistake and the reload, so the record
    // has to be written when the mistake is served, not only by a later edit
    test("a reload straight after a mistake resumes the answer without a call", async () => {
        const client = mistakeClient();
        const g = build(userState(), client);
        g.tap(0);
        await g.hint();
        const again = build(userState(), client);
        expect(again.mistakes.has(0)).toBe(true);
        expect(again.hintButton).toEqual({ kind: "mistake" });
        await again.hint();
        expect(client.dailyPuzzleHint).toHaveBeenCalledTimes(1);
    });

    // invariant 2
    test("while a mistake stands the button quotes no level and no price", async () => {
        const g = build(userState(), mistakeClient());
        g.tap(0);
        expect(g.hintButton.kind).toBe("hint");
        await g.hint();
        expect(g.hintButton).toEqual({ kind: "mistake" });
        expect(g.caption).toEqual(expect.objectContaining({ key: "dailyPuzzle.mistake" }));
    });

    // invariant 3
    test("any change to the marks after a mistake re-enables a real press", async () => {
        const client = mistakeClient();
        const g = build(userState(), client);
        g.tap(0);
        await g.hint();
        expect(g.hintButton.kind).toBe("mistake");
        // clearing the wrong mark is a change like any other: the red cell and the caption go
        // with it
        g.tap(0);
        g.tap(0);
        expect(g.mistakeStands).toBe(false);
        expect(g.mistakes.size).toBe(0);
        expect(g.caption).toBeUndefined();
        expect(g.hintButton.kind).toBe("hint");
        await g.hint();
        expect(client.dailyPuzzleHint).toHaveBeenCalledTimes(2);
        expect(g.lastHint).toEqual(step);
    });

    // invariant 4
    test("a Throttled refusal is shown as no free checks left, not the generic failure", async () => {
        const client = fakeClient({
            dailyPuzzleHint: vi.fn(async () => ({
                kind: "error",
                code: 320,
                message: "max_free_checks",
            })),
        });
        const g = build(userState(), client);
        g.tap(0);
        await g.hint();
        expect(toastStore.showFailureToast).toHaveBeenCalledWith(
            expect.objectContaining({ key: "dailyPuzzle.noFreeChecks" }),
            expect.anything(),
        );
        expect(toastStore.showFailureToast).not.toHaveBeenCalledWith(
            expect.objectContaining({ key: "dailyPuzzle.failedHint" }),
            expect.anything(),
        );
    });

    test("checks left are on the button only once fewer than five remain", () => {
        const roomy = { ...puzzle, maxFreeChecks: 20 };
        const state = userState({ freeChecks: 15 });
        dailyPuzzleStore.set({ puzzles: [roomy], states: [state] });
        const many = new DailyPuzzleGame(fakeClient(), roomy, state, USER, game);
        expect(many.freeChecksLeft).toBe(5);
        expect(many.hintButton).not.toHaveProperty("checksLeft");
        // one more spent, and the count appears
        const state16 = userState({ freeChecks: 16 });
        dailyPuzzleStore.set({ puzzles: [roomy], states: [state16] });
        const few = new DailyPuzzleGame(fakeClient(), roomy, state16, USER, game);
        expect(few.hintButton).toMatchObject({ kind: "hint", checksLeft: 4 });
    });

    // invariant 5
    test("the Light Up rules name the four sides and rule out diagonals", () => {
        const rules = en.dailyPuzzle.games.light_up.rules;
        expect(rules).toMatch(/across or down/);
        expect(rules).toMatch(/never diagonally/);
        expect(rules).not.toMatch(/touch/);
    });

    // invariant 6
    test("after a level 3 reveal the caption is the reveal text and nothing is asked of the player", async () => {
        const reveal: ServedHint = {
            hint: { technique: 1, focus: [0, 1, 2], target: [0], conclusions: [[0, 1]] },
            level: 3,
            mistake: false,
        };
        const client = fakeClient({
            dailyPuzzleHint: vi.fn(async () => ({
                kind: "success",
                hint: reveal,
                hintsUsed: 1,
                state: userState({ hints: [reveal] }),
            })),
        });
        const g = build(userState(), client);
        await g.hint();
        expect(game.filled(model, g.state)).toContainEqual([0, 1]);
        expect(g.caption).toEqual(expect.objectContaining({ key: "dailyPuzzle.revealed" }));
        expect(g.target.size).toBe(0);
        // the cell it filled is shown as context, not as a move still to make
        expect(g.focus.has(0)).toBe(true);
        // the next edit clears it
        g.tap(4);
        expect(g.focus.size).toBe(0);
        expect(g.caption).toBeUndefined();
    });

    // invariant 6, the undo case: a reveal has nothing left to ask for, so undoing the cell it
    // filled must not leave "Filled in for you." describing a fill no longer on the board
    test("undoing a revealed cell retires the reveal caption and highlight", async () => {
        const reveal: ServedHint = {
            hint: { technique: 1, focus: [0, 1, 2], target: [0], conclusions: [[0, 1]] },
            level: 3,
            mistake: false,
        };
        const client = fakeClient({
            dailyPuzzleHint: vi.fn(async () => ({
                kind: "success",
                hint: reveal,
                hintsUsed: 1,
                state: userState({ hints: [reveal] }),
            })),
        });
        const g = build(userState(), client);
        await g.hint();
        expect(g.caption).toEqual(expect.objectContaining({ key: "dailyPuzzle.revealed" }));
        g.tap(0);
        expect(game.filled(model, g.state)).not.toContainEqual([0, 1]);
        expect(g.caption).toBeUndefined();
        expect(g.focus.size).toBe(0);
    });
});

// #9361: a reset clears the board and nothing else
describe("reset (#9361)", () => {
    const emptyBytes = () => game.toBytes(model, game.empty(model));

    // invariant 5
    test("a single tap never clears the board; the confirming tap does", () => {
        const g = build(userState());
        g.tap(0);
        g.reset();
        expect(g.resetArmed).toBe(true);
        expect(game.filled(model, g.state)).toEqual([[0, 1]]);
        g.reset();
        expect(g.resetArmed).toBe(false);
        expect(game.filled(model, g.state)).toEqual([]);
    });

    test("an edit between the two taps disarms the reset", () => {
        const g = build(userState());
        g.tap(0);
        g.reset();
        g.tap(4);
        expect(g.resetArmed).toBe(false);
        g.reset();
        expect(g.resetArmed).toBe(true);
        expect(game.filled(model, g.state).length).toBe(2);
    });

    // invariants 1 and 2
    test("a reset sends exactly one save of the empty grid and touches nothing else", () => {
        vi.useFakeTimers();
        try {
            const client = fakeClient();
            const g = build(userState({ freeChecks: 1 }), client);
            g.tap(0);
            g.tap(4);
            const before = g.userState;
            client.dailyPuzzleSaveGrid.mockClear();
            g.reset();
            g.reset();
            expect(client.dailyPuzzleSaveGrid).toHaveBeenCalledTimes(1);
            expect(client.dailyPuzzleSaveGrid).toHaveBeenCalledWith("light_up", emptyBytes());
            // the debounced save the edits had queued finds nothing dirty
            vi.advanceTimersByTime(6000);
            expect(client.dailyPuzzleSaveGrid).toHaveBeenCalledTimes(1);
            expect(client.dailyPuzzleStart).not.toHaveBeenCalled();
            expect(client.dailyPuzzleSubmit).not.toHaveBeenCalled();
            expect(client.dailyPuzzleHint).not.toHaveBeenCalled();
            expect(g.userState).toEqual(before);
        } finally {
            vi.useRealTimers();
        }
    });

    // invariant 3
    test("a resume after a reset yields the empty board", () => {
        const client = fakeClient();
        const g = build(userState(), client);
        g.tap(0);
        g.reset();
        g.reset();
        // device copy
        const again = build(userState(), client);
        expect(game.filled(model, again.state)).toEqual([]);
        // server copy: what was saved is the empty grid
        const [, saved] = client.dailyPuzzleSaveGrid.mock.calls.at(-1)!;
        expect(game.fromBytes(model, saved)).toEqual(game.empty(model));
    });

    // invariant 4
    test("reset is unavailable before start, after solve, and on an empty board", async () => {
        expect(build(userState({ startedAt: undefined })).canReset).toBe(false);
        expect(build(userState()).canReset).toBe(false);
        const g = build(userState());
        g.tap(0);
        expect(g.canReset).toBe(true);
        const solved = build(
            userState({
                solved: { solvedAt: 2n, solveTimeMs: 1n, reward: 250, hintsUsed: 0, streak: 1 },
                grid: game.toBytes(model, game.apply(model, game.empty(model), 0, 1)),
                gridSavedAt: 5n,
            }),
        );
        expect(game.filled(model, solved.state).length).toBe(1);
        expect(solved.canReset).toBe(false);
        solved.reset();
        expect(solved.resetArmed).toBe(false);
    });

    test("a reset clears the mistake, hint highlight and caption with the marks", async () => {
        const mistake: ServedHint = {
            hint: { technique: 0, focus: [0], target: [], conclusions: [] },
            level: 1,
            mistake: true,
        };
        const client = fakeClient({
            dailyPuzzleHint: vi.fn(async () => ({
                kind: "success",
                hint: mistake,
                hintsUsed: 0,
                state: userState({ hints: [mistake] }),
            })),
        });
        const g = build(userState(), client);
        g.tap(0);
        await g.hint();
        expect(g.mistakes.size).toBe(1);
        g.reset();
        g.reset();
        expect(g.mistakes.size).toBe(0);
        expect(g.caption).toBeUndefined();
        expect(g.focus.size).toBe(0);
        expect(g.hintButton.kind).toBe("hint");
    });
});
