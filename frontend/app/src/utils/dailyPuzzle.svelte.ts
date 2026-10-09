import {
    ANON_USER_ID,
    ErrorCode,
    chitStateStore,
    dailyPuzzleStore,
    descriptionToHex,
    publish,
    puzzleFingerprint,
    puzzleReplaced,
    stateFor,
    todaysPuzzle,
    type DailyPuzzleSolved,
    type DailyPuzzleUserState,
    type DailyResultContent,
    type HintCaption,
    type HintKeyStatus,
    type OpenChat,
    type PublicDailyPuzzle,
    type ResourceKey,
    type ServedHint,
    type Violation,
} from "@client";
import { _, locale } from "svelte-i18n";
import { get } from "svelte/store";
import { i18nKey } from "../i18n/i18n";
import { toastStore } from "../stores/toast";
import { dailyPuzzleGame, gameI18nPrefix, type DailyPuzzleGameDef } from "./dailyPuzzleGames";
import type { PuzzleBoard } from "./puzzleBoard.svelte";

// A game's own sentence for a step, with its values made readable: a string of the game's
// translated first (a room's colour, "the orange room"), a list joined as the player's language
// joins one ("3 and 5")
function captionKey(prefix: string, caption: HintCaption): ResourceKey {
    const params: Record<string, string | number> = {};
    for (const [name, value] of Object.entries(caption.params ?? {})) {
        if (typeof value === "number") params[name] = value;
        else if (Array.isArray(value)) params[name] = joinList(value.map(String));
        else params[name] = get(_)(`${prefix}.${value.key}`);
    }
    return i18nKey(`${prefix}.${caption.key}`, params);
}

function joinList(items: string[]): string {
    try {
        return new Intl.ListFormat(get(locale) ?? "en", { type: "conjunction" }).format(items);
    } catch {
        return items.join(", ");
    }
}

const SERVER_SAVE_INTERVAL = 5000;

function localKey(userId: string, number: number): string {
    return `daily_puzzle_${userId}_${number}`;
}

// The marks a mistake hint was answered against (`filledKey`) and the cells it flagged. The same
// marks get the same answer, so while they stand the answer is shown rather than asked for
// again, and after a reload too (#9360 invariant 1).
export type MistakeRecord = { filledKey: string; keys: number[] };

// The user's marks as `filled()` pairs, replayed through `apply` on resume. Unlike the server
// copy (submission bytes) this keeps "no" marks. `fingerprint` ties the marks to the exact
// puzzle they were saved against (see puzzleFingerprint).
type LocalMarks = {
    filled: [number, number][];
    savedAt: number;
    fingerprint: string;
    mistake?: MistakeRecord;
};

function readLocal(userId: string, number: number): LocalMarks | undefined {
    if (userId === ANON_USER_ID) return undefined;
    try {
        const raw = localStorage.getItem(localKey(userId, number));
        const value = raw ? (JSON.parse(raw) as Partial<LocalMarks>) : undefined;
        return value !== undefined && Array.isArray(value.filled)
            ? (value as LocalMarks)
            : undefined;
    } catch {
        return undefined;
    }
}

function writeLocal(
    userId: string,
    number: number,
    fingerprint: string,
    filled: [number, number][],
    mistake: MistakeRecord | undefined,
): void {
    if (userId === ANON_USER_ID) return;
    try {
        const value: LocalMarks = { filled, savedAt: Date.now(), fingerprint, mistake };
        localStorage.setItem(localKey(userId, number), JSON.stringify(value));
    } catch {
        // storage unavailable: the server copy still exists
    }
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
    return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function formatSolveTime(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
    return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

/** Free checks the server still allows before it throttles; shown once fewer than this remain. */
export const SHOW_CHECKS_LEFT_BELOW = 5;

/**
 * What the hint button offers. Decided here rather than in the two pages so both agree and the
 * decision is testable: while a mistake hint stands on an unchanged board the server would only
 * repeat it, so no price is quoted (#9360 invariant 2).
 */
export type HintButton =
    | { kind: "mistake" }
    | { kind: "noneLeft" }
    | { kind: "hint"; price: number; hintsLeft: number; checksLeft?: number };

export function tierKey(tier: number): string {
    return `dailyPuzzle.tier.${tier}`;
}

/** The i18n key for a game's display name; unknown ids render as the raw key. */
export function gameNameKey(gameId: string): string {
    return `${gameI18nPrefix(gameId)}.name`;
}

/**
 * Today's puzzle for `gameId` (with no id, the first enabled one) and a play session on it. No
 * session when there is no puzzle, or when this build cannot render its game (`def` undefined).
 */
export function openDailyPuzzle(
    client: OpenChat,
    gameId: string | undefined,
    userId: string,
): { puzzle?: PublicDailyPuzzle; def?: DailyPuzzleGameDef; game?: DailyPuzzleGame } {
    const puzzle = todaysPuzzle(dailyPuzzleStore.value, gameId);
    const def = puzzle !== undefined ? dailyPuzzleGame(puzzle.gameId) : undefined;
    if (puzzle === undefined || def === undefined) return { puzzle, def };
    return {
        puzzle,
        def,
        game: new DailyPuzzleGame(client, puzzle, userId, def, def.demo !== undefined),
    };
}

// Everything the puzzle screen needs that is not layout: the marks, rule state, hint flow,
// saving and the submit path. Both the desktop modal and the mobile page render this, and read
// nothing about the session from anywhere else (#9824). The shell knows nothing about the game
// itself: it holds a PuzzleBoard, which keeps the game's model and state to itself.
export class DailyPuzzleGame {
    // The poll can bring a different puzzle while the screen is open: a regenerate, or rollover.
    // The board is rebuilt from the new one so no marks from the old puzzle remain, and
    // `replaced` tells the player (#9334 invariant 58)
    puzzle: PublicDailyPuzzle;
    board: PuzzleBoard;
    #fingerprint = "";
    replaced = $state(false);
    focus = $state<Set<number>>(new Set());
    target = $state<Set<number>>(new Set());
    // the caption a hint step set; a standing mistake overrides it (see `caption`)
    #caption = $state<ResourceKey | undefined>(undefined);
    #lastMistake = $state.raw<MistakeRecord | undefined>(undefined);
    // The cells the last mistake hint flagged, for as long as the marks it was answered against
    // stand. Any edit hides them; editing back to the same marks shows them again, since the
    // server would only say the same thing (#9360).
    mistakes = $derived.by((): Set<number> => {
        const last = this.#lastMistake;
        return last !== undefined && last.filledKey === this.#filledKey()
            ? new Set(last.keys)
            : new Set();
    });
    caption = $derived.by((): ResourceKey | undefined =>
        this.mistakes.size > 0 ? i18nKey("dailyPuzzle.mistake") : this.#caption,
    );
    busy = $state(false);
    submitting = $state(false);
    // A reset needs a confirming second tap; any edit in between disarms it (#9361 invariant 5)
    resetArmed = $state(false);
    // The player asked for the tutorial over a started game. It only takes effect while the game
    // is unsolved (see `tutorialOpen`), so a solve that lands meanwhile shows the board (#9822).
    #tutorialRequested = $state(false);
    // the most recent hint step served for this puzzle (a mistake hint is not a step)
    lastHint = $state<ServedHint | undefined>(undefined);
    // The server refused a hint for `max_hints`: it has the last word on which step is next, so
    // once it says none are left, none are offered
    #outOfHints = $state(false);

    // rule violations plus the keys the server flagged in a mistake hint, for the board
    violations = $derived.by((): Violation[] => {
        const out = this.board.violations;
        return this.mistakes.size > 0
            ? [...out, { keys: [...this.mistakes], kind: "mistake" }]
            : out;
    });

    // The store's `.value` is not tracked by Svelte, so a $derived reading it straight would keep
    // a stale hint count after a hint is bought (#9675 invariant 28): mirror it into state
    #store = $state.raw(dailyPuzzleStore.value);
    #chitBalance = $state(chitStateStore.value.chitBalance);
    #unsubscribe: () => void;
    #unsubscribeChit: () => void;
    #dirty = false;
    #saveTimer: number | undefined;
    #disposed = false;
    #onVisibility = () => {
        if (document.visibilityState === "hidden") this.flushSave();
    };

    constructor(
        private client: OpenChat,
        puzzle: PublicDailyPuzzle,
        private userId: string,
        private def: DailyPuzzleGameDef,
        // whether this game has a step-through demo to teach its rules
        readonly hasDemo = false,
    ) {
        this.puzzle = $state.raw(puzzle);
        this.#fingerprint = puzzleFingerprint(puzzle);
        this.board = $state.raw(this.#resume());
        this.lastHint = this.#lastHintServed();
        document.addEventListener("visibilitychange", this.#onVisibility);
        this.#unsubscribe = dailyPuzzleStore.subscribe((v) => {
            this.#store = v;
            const next = todaysPuzzle(v, this.puzzle.gameId);
            if (next !== undefined && puzzleReplaced(this.puzzle, next)) {
                this.#load(next);
                this.replaced = true;
            } else {
                this.#showSolvedGrid();
            }
        });
        this.#unsubscribeChit = chitStateStore.subscribe(
            (v) => (this.#chitBalance = v.chitBalance),
        );
    }

    // Starts the session on `puzzle` from its saved marks. A replacement starts clean: the old
    // puzzle's highlights, mistake, pending reset and unsaved marks all belonged to another board.
    #load(puzzle: PublicDailyPuzzle): void {
        window.clearTimeout(this.#saveTimer);
        this.#saveTimer = undefined;
        this.#dirty = false;
        this.puzzle = puzzle;
        this.#fingerprint = puzzleFingerprint(puzzle);
        this.focus = new Set();
        this.target = new Set();
        this.#caption = undefined;
        this.#lastMistake = undefined;
        this.resetArmed = false;
        this.#tutorialRequested = false;
        this.#outOfHints = false;
        this.board = this.#resume();
        this.lastHint = this.#lastHintServed();
    }

    // Once solved, the server holds the grid that was submitted. A board still showing an earlier
    // save, because the solve happened on another device while this one had the game open, would
    // read as solved with marks missing, so it is replaced by the solved grid.
    #showSolvedGrid(): void {
        const state = this.userState;
        if (state?.solved === undefined || state.grid.length === 0) return;
        if (state.gameId !== this.puzzle.gameId || state.number !== this.puzzle.number) return;
        if (sameBytes(state.grid, this.board.toBytes())) return;
        const board = this.def.newBoard(this.puzzle.description);
        board.load(state.grid);
        this.board = board;
    }

    #lastHintServed(): ServedHint | undefined {
        return [...(this.userState?.hints ?? [])].reverse().find((h) => !h.mistake);
    }

    dispose(): void {
        this.#disposed = true;
        document.removeEventListener("visibilitychange", this.#onVisibility);
        this.#unsubscribe();
        this.#unsubscribeChit();
        this.flushSave();
    }

    get userState(): DailyPuzzleUserState | undefined {
        return stateFor(this.#store, this.puzzle.gameId);
    }

    get started(): boolean {
        return this.userState?.startedAt !== undefined;
    }

    get solved(): DailyPuzzleSolved | undefined {
        return this.userState?.solved;
    }

    get streak(): number {
        return this.userState?.streak ?? 0;
    }

    /** The clock: the solve time once solved, time since Start while playing, 0 before Start. */
    elapsed(now: number): number {
        const solved = this.solved;
        if (solved !== undefined) return Number(solved.solveTimeMs);
        const startedAt = this.userState?.startedAt;
        return startedAt !== undefined ? now - Number(startedAt) : 0;
    }

    /** The server's quote for this user, re-checked on the start call; never computed here. */
    get entryFee(): number {
        return this.userState?.entryFee ?? this.puzzle.entryFee;
    }

    /** Caption shown before the puzzle is started. */
    get rulesKey(): ResourceKey {
        return i18nKey(`${gameI18nPrefix(this.puzzle.gameId)}.rules`);
    }

    // Pick the newer of the locally saved marks and the server's copy. Nothing is saved before
    // the puzzle is started, so nothing is resumed before it either. Either copy is ignored
    // unless it was saved against this exact puzzle: the local copy carries a fingerprint, the
    // server copy only its game id and number (the LUI drops records on rollover).
    #resume(): PuzzleBoard {
        const description = this.puzzle.description;
        const userState = this.userState;
        if (userState?.startedAt === undefined) return this.def.newBoard(description);
        const local = readLocal(this.userId, this.puzzle.number);
        const serverAt = userState.gridSavedAt !== undefined ? Number(userState.gridSavedAt) : 0;
        const localAt = local?.savedAt ?? 0;
        const serverIsThis =
            userState.gameId === this.puzzle.gameId && userState.number === this.puzzle.number;
        if (local !== undefined && local.fingerprint === this.#fingerprint) {
            const replayed = this.def.newBoard(description, local.filled);
            // The local copy is written on every edit and the server copy a few seconds after,
            // stamped by the canister, so by timestamp the server always looks newer. Only the
            // local copy keeps the "no" marks, so when the two hold the same board it is the
            // same save seen from both ends, and the local copy is the fuller one.
            const same = serverIsThis && sameBytes(userState.grid, replayed.toBytes());
            if (localAt >= serverAt || same) {
                this.#lastMistake = local.mistake;
                return replayed;
            }
        }
        const board = this.def.newBoard(description);
        if (serverIsThis) board.load(userState.grid);
        return board;
    }

    /** Start is offered unless a call is in flight or the balance is short of the quoted fee. */
    get canStart(): boolean {
        return !this.busy && this.#chitBalance >= this.entryFee;
    }

    start(): Promise<void> {
        if (this.busy) return Promise.resolve();
        this.busy = true;
        return this.client
            .dailyPuzzleStart(this.puzzle.gameId, this.entryFee)
            .then((resp) => {
                if (resp.kind === "error") {
                    toastStore.showFailureToast(i18nKey("dailyPuzzle.failedToStart"), resp);
                }
            })
            .catch((err) => {
                toastStore.showFailureToast(i18nKey("dailyPuzzle.failedToStart"), err);
            })
            .finally(() => {
                this.busy = false;
            });
    }

    get hintsUsed(): number {
        return this.userState?.hints.filter((h) => !h.mistake).length ?? 0;
    }

    get hintsLeft(): number {
        return Math.max(0, this.puzzle.maxHints - this.hintsUsed);
    }

    /** Free checks left before the server answers Throttled. */
    get freeChecksLeft(): number {
        return Math.max(0, this.puzzle.maxFreeChecks - (this.userState?.freeChecks ?? 0));
    }

    /** True while the marks a mistake hint was answered against are the marks on the board. */
    get mistakeStands(): boolean {
        return this.mistakes.size > 0;
    }

    get hintButton(): HintButton {
        if (this.mistakeStands) return { kind: "mistake" };
        const hintsLeft = this.hintsLeft;
        if (this.#outOfHints || hintsLeft === 0) return { kind: "noneLeft" };
        const checksLeft = this.freeChecksLeft;
        return {
            kind: "hint",
            price: this.hintPrice,
            hintsLeft,
            ...(checksLeft < SHOW_CHECKS_LEFT_BELOW ? { checksLeft } : {}),
        };
    }

    get inputDisabled(): boolean {
        return (
            !this.started ||
            this.submitting ||
            this.busy ||
            this.solved !== undefined ||
            this.tutorialOpen
        );
    }

    /** A hint can be asked for only when one is on offer, input is allowed and the price is covered. */
    get hintDisabled(): boolean {
        const button = this.hintButton;
        return this.inputDisabled || button.kind !== "hint" || this.#chitBalance < button.price;
    }

    /** The tutorial is offered once a game with a demo is under way, until it is solved. */
    get canToggleTutorial(): boolean {
        return this.hasDemo && this.started && this.solved === undefined;
    }

    get tutorialOpen(): boolean {
        return this.#tutorialRequested && this.canToggleTutorial;
    }

    /** The board area shows the demo: before Start, or while the tutorial is open (#9822). */
    get showsDemo(): boolean {
        return this.hasDemo && (!this.started || this.tutorialOpen);
    }

    /** The demo teaches the rules, so the paragraph is only for a game without one. */
    get showsRules(): boolean {
        return !this.hasDemo;
    }

    toggleTutorial(): void {
        if (!this.canToggleTutorial) return;
        this.#tutorialRequested = !this.#tutorialRequested;
    }

    tap(key: number): void {
        if (this.inputDisabled) return;
        if (!this.board.tap(key)) return;
        this.#afterChange();
        this.#trimHint();
    }

    /** A board to clear: started, not solved, and holding at least one mark (#9361 invariant 4). */
    get canReset(): boolean {
        return !this.inputDisabled && this.board.filled().length > 0;
    }

    // First call arms, second call clears (#9361 invariant 5). Clears the marks and every
    // highlight, and saves the empty grid at once so a reload on any device resumes an empty
    // board rather than the mess (#9361 invariant 3). Nothing else moves: the start time, hints,
    // free checks and any solve are the server's and are not touched (#9361 invariants 1, 2).
    reset(): void {
        if (!this.canReset) {
            this.resetArmed = false;
            return;
        }
        if (!this.resetArmed) {
            this.resetArmed = true;
            return;
        }
        this.resetArmed = false;
        this.board.clear();
        this.focus = new Set();
        this.target = new Set();
        this.#caption = undefined;
        this.#lastMistake = undefined;
        this.#afterChange();
        this.flushSave();
    }

    // Whether a key a hint named is still to act on, done, or scenery. A game whose hint keys
    // are not its mark keys answers for itself (#9370); otherwise a key is to do when it takes a
    // mark and has none, done when it has one, and context when it takes none (a vertex, a
    // clue, a tree).
    #keyStatus(key: number, filled: Set<number>): HintKeyStatus {
        const own = this.board.hintKeyStatus(key);
        if (own !== undefined) return own;
        if (!this.board.takesMark(key)) return "context";
        return filled.has(key) ? "done" : "todo";
    }

    // A hint's highlight and sentence describe a position, and once the player has made the
    // moves it asked for they describe the past: left up, they read as the game telling you to
    // do something you have already done. So the highlight only ever shows what is still to
    // do, cells drop out of it as they are marked, and once nothing markable is left the whole
    // hint goes on the player's next edit. The server never sends the conclusions, so "done"
    // cannot be read from the values; it is read from the keys the highlight named (#9334
    // invariant 61). Only a player edit trims.
    #trimHint(): void {
        if (this.focus.size === 0) return;
        const filled = new Set(this.board.filled().map(([k]) => k));
        const last = this.lastHint;
        const status = (k: number) => this.#keyStatus(k, filled);
        // What the player was asked to mark: the cells the deduction looked at, less the subject
        // the sentence points at (see #applyHint) and anything that takes no mark
        const subject = new Set(last?.hint.target ?? []);
        const asked = [...this.focus].filter((k) => !subject.has(k) && status(k) !== "context");
        const remaining = asked.filter((k) => status(k) === "todo");
        if (remaining.length === 0) {
            this.focus = new Set();
            this.target = new Set();
            this.#caption = undefined;
            return;
        }
        this.focus = new Set([...this.focus].filter((k) => subject.has(k) || status(k) !== "done"));
        this.target = new Set([...this.target].filter((k) => this.focus.has(k)));
    }

    #afterChange(): void {
        // Any change to the board, a tap or a reveal, disarms a pending reset: the confirming tap
        // must clear the board the player armed it on, not one that has changed since
        this.resetArmed = false;
        this.#dirty = true;
        writeLocal(
            this.userId,
            this.puzzle.number,
            this.#fingerprint,
            this.board.filled(),
            this.#lastMistake,
        );
        if (this.#saveTimer === undefined) {
            this.#saveTimer = window.setTimeout(() => {
                this.#saveTimer = undefined;
                this.flushSave();
            }, SERVER_SAVE_INTERVAL);
        }
        if (this.board.solved) {
            this.submit();
        }
    }

    flushSave(): void {
        if (!this.#dirty) return;
        if (!this.started || this.solved !== undefined) return;
        this.#dirty = false;
        this.client.dailyPuzzleSaveGrid(this.puzzle.gameId, this.board.toBytes());
    }

    submit(): Promise<void> {
        if (this.submitting || !this.started) return Promise.resolve();
        if (this.solved !== undefined) return Promise.resolve();
        this.submitting = true;
        this.#dirty = false;
        return this.client
            .dailyPuzzleSubmit(this.puzzle.gameId, this.board.toBytes())
            .then((resp) => {
                if (resp.kind === "error") {
                    toastStore.showFailureToast(
                        i18nKey(
                            resp.message === "wrong"
                                ? "dailyPuzzle.wrong"
                                : "dailyPuzzle.failedToSubmit",
                        ),
                        resp,
                    );
                }
            })
            .catch((err) => {
                toastStore.showFailureToast(i18nKey("dailyPuzzle.failedToSubmit"), err);
            })
            .finally(() => {
                if (!this.#disposed) this.submitting = false;
            });
    }

    /** What a hint costs: one level, one price (#9675). */
    get hintPrice(): number {
        return this.puzzle.hintPrices[0] ?? 0;
    }

    #filledKey(): string {
        return JSON.stringify(this.board.filled());
    }

    hint(): Promise<void> {
        if (this.inputDisabled || this.busy) return Promise.resolve();
        // The answer to these marks is already on screen, and asking again would spend a free
        // check on it (#9360 invariant 1)
        if (this.mistakeStands) return Promise.resolve();
        this.busy = true;
        return this.#requestHint(this.hintPrice, false).finally(() => {
            this.busy = false;
        });
    }

    // The server quotes the right price back on a mismatch (the step it picked, and what this
    // user has already bought, are its to know), so one retry with that quote is the honest
    // move; a second mismatch is an error. A quote above the price on the button is never paid:
    // the player agreed to what the button said, not to whatever the server asks (#9517
    // invariant 2).
    #requestHint(price: number, retried: boolean): Promise<void> {
        const board = this.board;
        // The level argument is what the server once sold hints in; it now ignores it (#9675)
        return this.client
            .dailyPuzzleHint(this.puzzle.gameId, 1, board.hintFilled(), price)
            .then((resp) => {
                // An answer about a puzzle the poll has since replaced says nothing about this one
                if (this.board !== board) return;
                if (resp.kind === "error") {
                    const quoted = Number(resp.message);
                    if (
                        resp.code === ErrorCode.PriceMismatch &&
                        !retried &&
                        Number.isFinite(quoted) &&
                        quoted <= price
                    ) {
                        return this.#requestHint(quoted, true);
                    }
                    const outOfHints =
                        resp.code === ErrorCode.Throttled && resp.message === "max_hints";
                    if (outOfHints) this.#outOfHints = true;
                    toastStore.showFailureToast(
                        i18nKey(
                            outOfHints
                                ? "dailyPuzzle.noHintsLeft"
                                : resp.code === ErrorCode.Throttled
                                  ? "dailyPuzzle.noFreeChecks"
                                  : "dailyPuzzle.failedHint",
                        ),
                        resp,
                    );
                    return;
                }
                if (resp.hint.mistake) {
                    this.#lastMistake = {
                        filledKey: this.#filledKey(),
                        keys: resp.hint.hint.focus,
                    };
                    this.focus = new Set();
                    this.target = new Set();
                    this.#caption = undefined;
                    writeLocal(
                        this.userId,
                        this.puzzle.number,
                        this.#fingerprint,
                        this.board.filled(),
                        this.#lastMistake,
                    );
                    return;
                }
                this.lastHint = resp.hint;
                this.#lastMistake = undefined;
                this.#applyHint(resp.hint);
            })
            .catch((err) => {
                toastStore.showFailureToast(i18nKey("dailyPuzzle.failedHint"), err);
            });
    }

    // One level (#9675): every hint is the step's outline and its sentence, and never its answer.
    // A hint kept from the three-level ladder is drawn the same way: one bought at level 1 has no
    // technique, so no sentence, and one bought at level 3 has its conclusions ignored.
    #applyHint(hint: ServedHint): void {
        // Cells the player has already marked are not shown: the hint is about what is left.
        // The target is the sentence's subject ("the outlined cells"), and the server sends it
        // only when it names no concluded key, so it is never the move asked for: it stays in the
        // highlight whether marked or not, or the sentence would sit on the answer cell instead of
        // the cell it describes.
        const filled = new Set(this.board.filled().map(([k]) => k));
        const subject = new Set(hint.hint.target);
        const show = (keys: number[]) =>
            keys.filter((k) => subject.has(k) || this.#keyStatus(k, filled) !== "done");
        this.focus = new Set([...show(hint.hint.focus), ...subject]);
        // no target: point at everything in focus
        this.target = subject.size > 0 ? subject : new Set(this.focus);
        const prefix = gameI18nPrefix(this.puzzle.gameId);
        const technique = hint.hint.technique;
        const own = technique === 0 ? undefined : this.board.hintCaption(hint.hint);
        this.#caption =
            own !== undefined
                ? captionKey(prefix, own)
                : technique === 0
                  ? undefined
                  : i18nKey(`${prefix}.technique.${technique}`);
    }

    resultCard(): DailyResultContent | undefined {
        const solved = this.solved;
        if (solved === undefined) return undefined;
        return {
            kind: "daily_result",
            gameId: this.puzzle.gameId,
            number: this.puzzle.number,
            userId: this.userId,
            solveTimeMs: Number(solved.solveTimeMs),
            hintsUsed: solved.hintsUsed,
            streak: solved.streak,
            layout: descriptionToHex(this.puzzle.description),
            tier: this.puzzle.tier,
        };
    }

    get canShare(): boolean {
        const solved = this.solved;
        return solved !== undefined && solved.solveTimeMs >= this.puzzle.minCardedSolveMs;
    }

    share(): void {
        const card = this.resultCard();
        if (card !== undefined) publish("shareDailyResult", card);
    }
}
