import {
    bridges,
    chitStateStore,
    dailyPuzzleStore,
    ErrorCode,
    lightUp,
    slant,
    puzzleFingerprint,
    type DailyPuzzleUserState,
    type OpenChat,
    type PublicDailyPuzzle,
    type ServedHint,
} from "@client";
import { flushSync } from "svelte";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { toastStore } from "../stores/toast";
import { DailyPuzzleGame, type HintButton } from "./dailyPuzzle.svelte";
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
    hintPrices: [25],
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

const game = lightUp;
const lightUpDef = dailyPuzzleGame("light_up")!;
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

function build(
    state: DailyPuzzleUserState | undefined,
    client = fakeClient(),
    hasDemo = false,
): DailyPuzzleGame {
    dailyPuzzleStore.set({ puzzles: [puzzle], states: state === undefined ? [] : [state] });
    return new DailyPuzzleGame(client, puzzle, USER, lightUpDef, hasDemo);
}

function saveLocal(
    savedAt: number,
    fingerprint = puzzleFingerprint(puzzle),
    filled: [number, number][] = [[0, 1]],
): void {
    localStorage.setItem(
        `daily_puzzle_${USER}_${NUMBER}`,
        JSON.stringify({ filled, savedAt, fingerprint }),
    );
}

// A served hint as the engine shapes it below level 3: no conclusions, and a target only when
// it names none of them (see hint_at_level in daily_puzzle_engine.rs)
function served(focus: number[], target: number[] = [], level = 1): ServedHint {
    return { hint: { technique: 1, focus, target, conclusions: [] }, level, mistake: false };
}

function hintClient(hint: ServedHint, state: Partial<DailyPuzzleUserState> = {}): OpenChat & Fake {
    return fakeClient({
        dailyPuzzleHint: vi.fn(async () => ({
            kind: "success",
            hint,
            hintsUsed: 1,
            state: userState({ ...state, hints: [hint] }),
        })),
    });
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
        expect(g.board.solved).toBe(false);
        expect(client.dailyPuzzleSubmit).not.toHaveBeenCalled();
        g.tap(8);
        expect(g.board.solved).toBe(true);
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
    // A game already open on one device (desktop) while the puzzle is solved on another (phone)
    test("a puzzle solved on another device shows the board that was submitted", () => {
        // The phone's last timed save, a move short of solved
        const lastSave = game.apply(model, game.empty(model), 4, 1);
        const g = build(userState({ grid: game.toBytes(model, lastSave), gridSavedAt: 1000n }));
        expect([...g.board.marks.keys()]).toEqual([4]);

        // The phone's final move, then its submit: the server stores the submitted grid with the solve
        const submitted = game.toBytes(model, game.apply(model, lastSave, 0, 1));
        dailyPuzzleStore.set({
            puzzles: [puzzle],
            states: [
                userState({
                    grid: submitted,
                    gridSavedAt: 2000n,
                    solved: {
                        solvedAt: 2000n,
                        solveTimeMs: 1n,
                        reward: 250,
                        hintsUsed: 0,
                        streak: 1,
                    },
                }),
            ],
        });
        flushSync();

        expect(g.solved).toBeDefined();
        expect([...g.board.marks.keys()].sort()).toEqual([0, 4]);
    });

    test("resume takes the newer of the local and server grids by timestamp", () => {
        const serverGrid = game.toBytes(model, game.apply(model, game.empty(model), 4, 1));
        const server = { grid: serverGrid, gridSavedAt: 1000n };

        saveLocal(2000);
        expect([...build(userState(server)).board.marks.keys()]).toEqual([0]);

        saveLocal(500);
        expect([...build(userState(server)).board.marks.keys()]).toEqual([4]);

        // A local copy saved against another layout is not this puzzle's, however new
        saveLocal(2000, "light_up:20706:deadbeef");
        expect([...build(userState(server)).board.marks.keys()]).toEqual([4]);

        // Nothing is resumed before the puzzle is started
        saveLocal(2000);
        expect(build(userState({ ...server, startedAt: undefined })).board.marks.size).toBe(0);
    });

    // #9404 invariant 4
    test('resume keeps the local "no" marks when the server copy is later but holds the same bulbs', () => {
        const serverGrid = game.toBytes(model, game.apply(model, game.empty(model), 4, 1));
        const server = { grid: serverGrid, gridSavedAt: 1000n };

        // Same bulb, one "no" mark more, stamped before the canister stamped the save
        saveLocal(500, puzzleFingerprint(puzzle), [
            [4, 1],
            [0, 0],
        ]);
        const marks = build(userState(server)).board.marks;
        expect(marks.get(4)).toBe("bulb");
        expect(marks.get(0)).toBe("dot");

        // A different board saved earlier is older, not fuller: the server copy wins
        saveLocal(500, puzzleFingerprint(puzzle), [
            [8, 1],
            [0, 0],
        ]);
        expect([...build(userState(server)).board.marks.keys()]).toEqual([4]);
    });

    // #9332 invariant 43
    test("a hint clears itself once the player has made the move it pointed at", async () => {
        // No target: the hint points at everything in focus. The diagonal cells do not light
        // one another, so each needs its own mark
        const g = build(userState(), hintClient(served([0, 4, 8])));
        await g.hint();
        expect([...g.focus]).toEqual([0, 4, 8]);
        expect([...g.target]).toEqual([0, 4, 8]);

        // One of the cells gets its mark: the hint stays for the rest, and the marked cell
        // drops out of the highlight
        g.tap(4);
        expect([...g.focus].sort()).toEqual([0, 8]);
        expect([...g.target].sort()).toEqual([0, 8]);

        // The last of them: acted on, so the hint goes
        g.tap(0);
        g.tap(8);
        expect(g.focus.size).toBe(0);
        expect(g.target.size).toBe(0);
        expect(g.caption).toBeUndefined();
    });

    // #9404 invariant 3
    test("a lit cell with no mark is done: the bulb that lights the cells asked for retires the hint", async () => {
        const g = build(userState(), hintClient(served([0, 1, 2])));
        await g.hint();
        // the bulb at 1 lights 0 and 2, so nothing in focus is left to do
        g.tap(1);
        expect(g.focus.size).toBe(0);
        expect(g.caption).toBeUndefined();
    });

    // #9404 invariants 1 and 2: the target below level 3 is the sentence's subject ("this cell
    // can only be lit from one place"), never the move asked for
    describe("a hint whose target is a markable cell", () => {
        // cell 0 is the subject, cell 4 is where the bulb goes (off its lines, so a stray bulb on
        // the subject does not light it)
        const step = served([0, 4], [0], 2);

        test("keeps a target the player had already marked, so the sentence sits on the cell it describes", async () => {
            const g = build(userState(), hintClient(step));
            g.tap(0);
            g.tap(0); // bulb, then "no"
            expect(g.board.marks.get(0)).toBe("dot");
            await g.hint();
            expect([...g.focus].sort()).toEqual([0, 4]);
            expect([...g.target]).toEqual([0]);
            expect(g.caption).toBeDefined();
        });

        test("keeps a target the player marks after the hint, and does not retire on it", async () => {
            const g = build(userState(), hintClient(step));
            await g.hint();
            g.tap(0);
            g.tap(0);
            expect([...g.focus].sort()).toEqual([0, 4]);
            expect([...g.target]).toEqual([0]);
        });

        test("retires once the cell outside the target is done, and not on an edit elsewhere", async () => {
            const g = build(userState(), hintClient(step));
            await g.hint();
            g.tap(8); // a bulb at 8 lights neither 0 nor 4
            expect([...g.focus].sort()).toEqual([0, 4]);
            g.tap(4);
            expect(g.focus.size).toBe(0);
            expect(g.target.size).toBe(0);
            expect(g.caption).toBeUndefined();
        });
    });

    // #9675 H3: one level, one price. Every tap asks for a new step at the puzzle's one price,
    // whatever the last hint was.
    test("every hint is quoted at the one price", async () => {
        const hint: ServedHint = {
            hint: { technique: 1, focus: [0, 1, 2], target: [0], conclusions: [] },
            level: 2,
            mistake: false,
        };
        const client = hintClient(hint);
        const g = build(userState(), client);
        expect(g.hintButton).toMatchObject({ kind: "hint", price: 25 });
        await g.hint();
        expect(g.hintButton).toMatchObject({ kind: "hint", price: 25 });
        await g.hint();
        expect(client.dailyPuzzleHint).toHaveBeenLastCalledWith(
            "light_up",
            1,
            expect.anything(),
            25,
        );
    });

    // #9675 invariant 27: a hint with technique 0 (served at level 1 by a LocalUserIndex that
    // predates one-level hints, or bought at level 1 before them) draws its outline with no
    // sentence, never the raw key of a technique that doesn't exist
    test("a hint with no technique draws its outline and no sentence", async () => {
        const hint: ServedHint = {
            hint: { technique: 0, focus: [0, 1, 2], target: [], conclusions: [] },
            level: 1,
            mistake: false,
        };
        const g = build(userState(), hintClient(hint));
        await g.hint();
        expect([...g.focus].sort()).toEqual([0, 1, 2]);
        expect(g.caption).toBeUndefined();
    });

    // #9675 H4: a step is drawn the same however it arrives: bought, re-served free, or re-served
    // after a reload
    test("a hint re-served for free draws exactly as when it was bought", async () => {
        const hint: ServedHint = {
            hint: { technique: 2, focus: [0, 1, 2, 3], target: [0], conclusions: [] },
            level: 2,
            mistake: false,
        };
        const drawn = (g: DailyPuzzleGame) => ({
            focus: [...g.focus].sort(),
            target: [...g.target].sort(),
            caption: g.caption,
        });
        const g = build(userState(), hintClient(hint, { hints: [hint] }));
        await g.hint();
        const bought = drawn(g);
        expect(bought.target).toEqual([0]);
        expect(bought.caption).toBeDefined();

        await g.hint();
        expect(drawn(g)).toEqual(bought);

        const reloaded = build(userState({ hints: [hint] }), hintClient(hint, { hints: [hint] }));
        await reloaded.hint();
        expect(drawn(reloaded)).toEqual(bought);
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
                .mockResolvedValueOnce({ kind: "error", code: 250, message: "20" })
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
            20,
        );
        expect(toastStore.showFailureToast).not.toHaveBeenCalled();
        expect(g.lastHint).toEqual(hint);
        expect(g.busy).toBe(false);
    });

    test("a second price mismatch is an error, not a loop", async () => {
        const client = fakeClient({
            dailyPuzzleHint: vi.fn(async () => ({ kind: "error", code: 250, message: "20" })),
        });
        const g = build(userState(), client);
        await g.hint();
        expect(client.dailyPuzzleHint).toHaveBeenCalledTimes(2);
        expect(toastStore.showFailureToast).toHaveBeenCalled();
    });

    test("a price mismatch quoting more than the button showed is not retried", async () => {
        const client = fakeClient({
            dailyPuzzleHint: vi.fn(async () => ({ kind: "error", code: 250, message: "200" })),
        });
        const g = build(userState(), client);
        expect(g.hintButton).toMatchObject({ kind: "hint", price: 25 });
        await g.hint();
        expect(client.dailyPuzzleHint).toHaveBeenCalledTimes(1);
        expect(toastStore.showFailureToast).toHaveBeenCalled();
        expect(g.lastHint).toBeUndefined();
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
        const slantDef = dailyPuzzleGame("slant")!;
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
            return new DailyPuzzleGame(client, slantPuzzle, USER, slantDef);
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

// With every hint step used, the button offers only what the server will serve, and a refusal
// for the cap says so rather than blaming free checks
describe("out of hints", () => {
    // three steps used, the last served at level 1: it asked for cells 1 and 2 to be lit
    const threeSteps = [served([4]), served([8]), served([1, 2])];

    // invariant 18. The client cannot tell whether the server would climb the last step or move
    // on to a new one, which it refuses at the cap, so once every step is used nothing is offered:
    // not a new step, and not the next level of the last one, whatever the board shows
    test("with every hint step used, no hint is offered, not even the next level of the last one", () => {
        const g = build(userState({ hints: threeSteps }));
        // the last step was served at level 1 and cells 1 and 2 are still dark
        expect(g.hintButton).toEqual({ kind: "noneLeft" });
        g.tap(0);
        expect(g.hintButton).toEqual({ kind: "noneLeft" });
    });

    test("with a step left, a hint is still offered", () => {
        const g = build(userState({ hints: threeSteps.slice(1) }));
        expect(g.hintButton).toMatchObject({ kind: "hint", price: 25, hintsLeft: 1 });
    });

    // invariant 28. The screen reads the button through a $derived. The count comes from the
    // server's state, which lands in the store after the hint call returns, so the button must
    // follow the store: bought the last step, and it is off with nothing else on the board moving.
    test("the hint button follows the server's count as it lands, with no other change", () => {
        const g = build(userState({ hints: threeSteps.slice(1) }));
        let screen: { readonly button: HintButton } | undefined;
        const stop = $effect.root(() => {
            const button = $derived(g.hintButton);
            screen = {
                get button() {
                    return button;
                },
            };
        });
        expect(screen!.button).toMatchObject({ kind: "hint", hintsLeft: 1 });
        dailyPuzzleStore.set({ puzzles: [puzzle], states: [userState({ hints: threeSteps })] });
        flushSync();
        expect(screen!.button).toEqual({ kind: "noneLeft" });
        stop();
    });

    // invariant 19
    test("a max_hints refusal turns the button off and says no hints are left", async () => {
        const client = fakeClient({
            dailyPuzzleHint: vi.fn(async () => ({
                kind: "error",
                code: 320,
                message: "max_hints",
            })),
        });
        const g = build(userState(), client);
        g.tap(0);
        await g.hint();
        expect(g.hintButton).toEqual({ kind: "noneLeft" });
        expect(toastStore.showFailureToast).toHaveBeenCalledWith(
            expect.objectContaining({ key: "dailyPuzzle.noHintsLeft" }),
            expect.anything(),
        );
    });
});

// CHAT Rooms crosses out, for the player, every cell a placed CHAT rules out. A hint request
// carries those crosses; the saved marks never do.
describe("a game that shows more than the player's marks (chat_rooms)", () => {
    const rooms = [0, 0, 0, 0, 1, 2, 0, 0, 2, 1, 2, 2, 2, 2, 1, 2, 2, 2, 3, 3, 4, 2, 3, 3, 3];
    const roomsPuzzle: PublicDailyPuzzle = {
        ...puzzle,
        gameId: "chat_rooms",
        number: 20726,
        description: Uint8Array.from([1, 5, 5, ...rooms]),
    };
    const chatRoomsDef = dailyPuzzleGame("chat_rooms")!;

    // Invariants 14 and 15: the request sends `hintFilled`, the local save `filled`
    test("hint requests send the automatic crosses, and the saved marks leave them out", async () => {
        const client = hintClient(served([1]));
        const state = userState({ gameId: "chat_rooms", number: 20726 });
        dailyPuzzleStore.set({ puzzles: [roomsPuzzle], states: [state] });
        const g = new DailyPuzzleGame(client, roomsPuzzle, USER, chatRoomsDef);
        g.tap(20);
        g.tap(20);
        await g.hint();

        const sent: [number, number][] = client.dailyPuzzleHint.mock.calls[0][2];
        expect(sent).toContainEqual([20, 1]);
        for (const k of [0, 5, 10, 15, 16, 21, 22, 23, 24]) expect(sent).toContainEqual([k, 0]);

        const saved = JSON.parse(localStorage.getItem(`daily_puzzle_${USER}_20726`)!);
        expect(saved.filled).toEqual([[20, 1]]);
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
        expect(g.board.filled()).toEqual([[0, 1]]);
        expect(g.mistakes.has(0)).toBe(true);
        expect(g.hintButton).toEqual({ kind: "mistake" });
        await g.hint();
        expect(client.dailyPuzzleHint).toHaveBeenCalledTimes(1);

        // A reload with the wrong mark still on the board resumes the same answer, so the first
        // press after it does not spend a free check repainting the same cell
        const again = build(userState(), client);
        expect(again.board.filled()).toEqual([[0, 1]]);
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
        expect(g.board.filled()).toEqual([[0, 1]]);
        g.reset();
        expect(g.resetArmed).toBe(false);
        expect(g.board.filled()).toEqual([]);
    });

    test("an edit between the two taps disarms the reset", () => {
        const g = build(userState());
        g.tap(0);
        g.reset();
        g.tap(4);
        expect(g.resetArmed).toBe(false);
        g.reset();
        expect(g.resetArmed).toBe(true);
        expect(g.board.filled().length).toBe(2);
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
        expect(again.board.filled()).toEqual([]);
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
        // and not while a call is in flight, or its response would land on an empty board
        g.busy = true;
        expect(g.canReset).toBe(false);
        g.busy = false;
        const solved = build(
            userState({
                solved: { solvedAt: 2n, solveTimeMs: 1n, reward: 250, hintsUsed: 0, streak: 1 },
                grid: game.toBytes(model, game.apply(model, game.empty(model), 0, 1)),
                gridSavedAt: 5n,
            }),
        );
        expect(solved.board.filled().length).toBe(1);
        expect(solved.canReset).toBe(false);
        solved.reset();
        expect(solved.resetArmed).toBe(false);
    });

    test("a reset clears the hint highlight and caption with the marks", async () => {
        const step: ServedHint = {
            hint: { technique: 1, focus: [0, 1, 2], target: [4], conclusions: [] },
            level: 2,
            mistake: false,
        };
        const client = fakeClient({
            dailyPuzzleHint: vi.fn(async () => ({
                kind: "success",
                hint: step,
                hintsUsed: 1,
                state: userState({ hints: [step] }),
            })),
        });
        const g = build(userState(), client);
        g.tap(0);
        await g.hint();
        expect(g.focus.size).toBeGreaterThan(0);
        expect(g.target.size).toBeGreaterThan(0);
        expect(g.caption).toBeDefined();
        g.reset();
        g.reset();
        expect(g.focus.size).toBe(0);
        expect(g.target.size).toBe(0);
        expect(g.caption).toBeUndefined();
    });

    test("a reset drops the mistake record: the same wrong mark afterwards is a fresh question", async () => {
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
        // the board no longer exists, so its answer is not carried over to a re-marked one
        g.tap(0);
        expect(g.mistakes.size).toBe(0);
        expect(g.hintButton.kind).toBe("hint");
    });
});

// #9370: Bridges hint keys are cells, its marks are edges, and the key spaces overlap
describe("a Bridges hint clears in its own key space (#9370)", () => {
    // 0 . 2 / . . . / 6 . 8: the edge 0 -> 2 (key 0) runs over cell 1; the edge 0 -> 6 (key 1)
    // runs over cell 3, so a hint naming cell 1 collides with that edge's key
    const bridgesPuzzle: PublicDailyPuzzle = {
        ...puzzle,
        gameId: "bridges",
        number: 20710,
        description: new Uint8Array([1, 3, 3, 2, 0, 2, 0, 0, 0, 2, 0, 2]),
    };
    const bridgesDef = dailyPuzzleGame("bridges")!;
    const hint = served([1, 2]);
    function buildBridges(committed: number[]): DailyPuzzleGame {
        const model = bridges.parse(bridgesPuzzle.description);
        let st = bridges.empty(model);
        for (const k of committed) st = bridges.tap(model, st, k);
        const grid = bridges.toBytes(model, st);
        const state = userState({ gameId: "bridges", number: 20710, grid, gridSavedAt: 5n });
        dailyPuzzleStore.set({ puzzles: [bridgesPuzzle], states: [state] });
        const client = fakeClient({
            dailyPuzzleHint: vi.fn(async () => ({
                kind: "success",
                hint,
                hintsUsed: 1,
                state: userState({ gameId: "bridges", number: 20710, hints: [hint] }),
            })),
        });
        return new DailyPuzzleGame(client, bridgesPuzzle, USER, bridgesDef);
    }

    // invariant 1
    test("clears once an edge through the cell is drawn, and not on an edit elsewhere", async () => {
        const g = buildBridges([]);
        await g.hint();
        expect([...g.focus].sort()).toEqual([1, 2]);
        expect([...g.target].sort()).toEqual([1, 2]);
        // the colliding edge (key 1, over cell 3) is not the bridge the hint asked for
        g.tap(1);
        expect([...g.target].sort()).toEqual([1, 2]);
        g.tap(12);
        expect([...g.target].sort()).toEqual([1, 2]);
        // the bridge over cell 1 is edge key 0
        g.tap(0);
        expect(g.focus.size).toBe(0);
        expect(g.target.size).toBe(0);
        expect(g.caption).toBeUndefined();
    });

    // The shape the server sends: the island is the target, the water cells of its edges are
    // in focus (backend/libraries/bridges). Islands are context, so the water cells are what is
    // asked for, and the hint clears once every one of them is decided
    test("with an island target, the hint clears once the water cells in focus are decided", async () => {
        const island: ServedHint = {
            hint: { technique: 1, focus: [2, 1, 0, 5, 8], target: [2], conclusions: [] },
            level: 1,
            mistake: false,
        };
        const model = bridges.parse(bridgesPuzzle.description);
        const state = userState({
            gameId: "bridges",
            number: 20710,
            grid: bridges.toBytes(model, bridges.empty(model)),
            gridSavedAt: 5n,
        });
        dailyPuzzleStore.set({ puzzles: [bridgesPuzzle], states: [state] });
        const client = fakeClient({
            dailyPuzzleHint: vi.fn(async () => ({
                kind: "success",
                hint: island,
                hintsUsed: 1,
                state: userState({ gameId: "bridges", number: 20710, hints: [island] }),
            })),
        });
        const g = new DailyPuzzleGame(client, bridgesPuzzle, USER, bridgesDef);
        await g.hint();
        expect([...g.focus].sort()).toEqual([0, 1, 2, 5, 8]);
        // an edge elsewhere (6 -> 8, over cell 7) changes nothing; island 0 collides with its key
        g.tap(12);
        expect([...g.focus].sort()).toEqual([0, 1, 2, 5, 8]);
        // the bridge over cell 1 settles that cell; cell 5 is still asked for
        g.tap(0);
        expect([...g.focus].sort()).toEqual([0, 2, 5, 8]);
        expect(g.caption).toBeDefined(); // one level: every hint has its sentence
        g.tap(5);
        expect(g.focus.size).toBe(0);
    });

    // invariant 2
    test("a water cell whose edge is already committed is not highlighted", async () => {
        const g = buildBridges([0]);
        await g.hint();
        expect(g.focus.has(1)).toBe(false);
        expect(g.target.has(1)).toBe(false);
        // the island stays as context
        expect(g.focus.has(2)).toBe(true);
    });
});

describe("the tutorial reopened mid-game (#9822)", () => {
    const solved = { solvedAt: 2n, solveTimeMs: 1n, reward: 250, hintsUsed: 0, streak: 1 };

    // invariant 2
    test("while the tutorial is open no tap, hint or reset reaches the game", async () => {
        const client = fakeClient();
        const g = build(userState(), client, true);
        g.tap(0);
        g.toggleTutorial();
        g.tap(4);
        expect(g.board.filled()).toEqual([[0, 1]]);
        expect(g.canReset).toBe(false);
        g.reset();
        g.reset();
        expect(g.board.filled()).toEqual([[0, 1]]);
        await g.hint();
        expect(client.dailyPuzzleHint).not.toHaveBeenCalled();
    });

    // invariant 3
    test("opening and closing the tutorial leaves the board's marks unchanged", () => {
        const g = build(userState(), fakeClient(), true);
        g.tap(0);
        g.tap(4);
        const before = g.board.filled();
        g.toggleTutorial();
        expect(g.showsDemo).toBe(true);
        g.toggleTutorial();
        expect(g.showsDemo).toBe(false);
        expect(g.board.filled()).toEqual(before);
    });

    // invariant 4
    test("once the puzzle is solved the board and result actions show, never the tutorial", () => {
        const g = build(userState(), fakeClient(), true);
        g.toggleTutorial();
        expect(g.tutorialOpen).toBe(true);
        // a solve that lands while the tutorial is open: an in-flight submit or another device
        dailyPuzzleStore.set({ puzzles: [puzzle], states: [userState({ solved })] });
        flushSync();
        expect(g.showsDemo).toBe(false);
        expect(g.tutorialOpen).toBe(false);
    });

    // invariant 6
    test("the tutorial can be reopened only on a started, unsolved game that has a demo", () => {
        expect(build(userState(), fakeClient(), true).canToggleTutorial).toBe(true);
        expect(build(undefined, fakeClient(), true).canToggleTutorial).toBe(false);
        expect(build(userState({ solved }), fakeClient(), true).canToggleTutorial).toBe(false);
        expect(build(userState(), fakeClient(), false).canToggleTutorial).toBe(false);
        // and a toggle that is not offered does nothing
        const g = build(userState({ solved }), fakeClient(), true);
        g.toggleTutorial();
        expect(g.tutorialOpen).toBe(false);
    });
});

describe("DailyPuzzleGame is the one source of truth for a play session (#9824)", () => {
    const solved = { solvedAt: 2n, solveTimeMs: 61_000n, reward: 250, hintsUsed: 0, streak: 1 };

    function balance(chitBalance: number): void {
        chitStateStore.update((s) => ({ ...s, chitBalance }));
    }

    // invariant 3
    test("a puzzle the poll replaces leaves no marks from the old one, and says so", () => {
        const client = fakeClient();
        const g = build(userState(), client);
        g.tap(0);
        expect(g.board.marks.size).toBe(1);
        expect(g.replaced).toBe(false);
        // rollover while the screen is open, and the player starts the new day's puzzle
        const next = { ...puzzle, number: NUMBER + 1 };
        dailyPuzzleStore.set({ puzzles: [next], states: [userState({ number: NUMBER + 1 })] });
        flushSync();
        expect(g.puzzle).toBe(next);
        expect(g.board.marks.size).toBe(0);
        expect(g.replaced).toBe(true);
        g.flushSave();
        expect(client.dailyPuzzleSaveGrid).not.toHaveBeenCalled();
    });

    // invariant 4
    test("the clock is 0 before Start, the time since Start while playing, and the solve time once solved", () => {
        expect(build(undefined).elapsed(5000)).toBe(0);
        expect(build(userState({ startedAt: 1000n })).elapsed(5000)).toBe(4000);
        expect(build(userState({ startedAt: 1000n, solved })).elapsed(5000)).toBe(61_000);
    });

    // invariant 5
    test("Start is offered only when not busy and the balance covers the quoted fee", async () => {
        balance(100);
        expect(build(undefined).canStart).toBe(true);
        balance(99);
        expect(build(undefined).canStart).toBe(false);
        balance(100);
        const client = fakeClient({ dailyPuzzleStart: vi.fn(() => new Promise(() => {})) });
        const g = build(undefined, client);
        g.start();
        expect(g.canStart).toBe(false);
        // a quote of 0 needs no balance
        balance(0);
        expect(build(userState({ startedAt: undefined, entryFee: 0 })).canStart).toBe(true);
    });

    // invariant 6
    test("the hint button is enabled only when a hint is on offer, input is allowed and the price is covered", () => {
        balance(25);
        expect(build(userState()).hintDisabled).toBe(false);
        // input not allowed: before Start, once solved
        expect(build(undefined).hintDisabled).toBe(true);
        expect(build(userState({ solved })).hintDisabled).toBe(true);
        // no hint on offer
        const used = [served([1]), served([2]), served([3])];
        expect(build(userState({ hints: used })).hintDisabled).toBe(true);
        // price not covered
        balance(24);
        expect(build(userState()).hintDisabled).toBe(true);
    });

    // invariant 7
    test("a hint answer for a puzzle the poll has since replaced changes nothing", async () => {
        const answers = [
            { kind: "success", hint: served([1, 2]), hintsUsed: 1, state: userState() },
            {
                kind: "success",
                hint: { ...served([3, 4]), mistake: true },
                hintsUsed: 1,
                state: userState(),
            },
            // a quote the button would accept: no retry, so nothing is bought for the new puzzle
            { kind: "error", code: ErrorCode.PriceMismatch, message: "20" },
            { kind: "error", code: ErrorCode.Throttled, message: "max_hints" },
        ];
        for (const answer of answers) {
            let reply!: (resp: unknown) => void;
            const client = fakeClient({
                dailyPuzzleHint: vi.fn(() => new Promise((resolve) => (reply = resolve))),
            });
            const g = build(userState(), client);
            const asked = g.hint();
            const next = { ...puzzle, number: NUMBER + 1 };
            dailyPuzzleStore.set({ puzzles: [next], states: [userState({ number: NUMBER + 1 })] });
            flushSync();
            reply(answer);
            await asked;
            expect(client.dailyPuzzleHint).toHaveBeenCalledTimes(1);
            expect(g.hintButton.kind).toBe("hint");
            expect(g.focus.size).toBe(0);
            expect(g.target.size).toBe(0);
            expect(g.caption).toBeUndefined();
            expect(g.lastHint).toBeUndefined();
            expect(g.mistakes.size).toBe(0);
        }
    });
});
