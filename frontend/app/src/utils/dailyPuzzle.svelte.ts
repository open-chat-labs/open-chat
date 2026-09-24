import {
    descriptionToHex,
    type DailyGame,
    type DailyPuzzleUserState,
    type DailyResultContent,
    type HintKeyStatus,
    type OpenChat,
    type PublicDailyPuzzle,
    type ResourceKey,
    type ServedHint,
    type Violation,
    ANON_USER_ID,
    ErrorCode,
    dailyPuzzleStore,
    publish,
    puzzleFingerprint,
    stateFor,
} from "@client";
import { i18nKey } from "../i18n/i18n";
import { toastStore } from "../stores/toast";
import { gameI18nPrefix } from "./dailyPuzzleGames";

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
 * repeat it, so no level or price is quoted (#9360 invariant 2).
 */
export type HintButton =
    | { kind: "mistake" }
    | { kind: "noneLeft" }
    | { kind: "hint"; level: number; price: number; hintsLeft: number; checksLeft?: number };

export function tierKey(tier: number): string {
    return `dailyPuzzle.tier.${tier}`;
}

/** The i18n key for a game's display name; unknown ids render as the raw key. */
export function gameNameKey(gameId: string): string {
    return `${gameI18nPrefix(gameId)}.name`;
}

// Everything the puzzle screen needs that is not layout: the marks, rule state, hint flow,
// saving and the submit path. Both the desktop modal and the mobile page render this. The
// shell knows nothing about the game itself: it holds an opaque `model` and `state` and goes
// through the DailyGame interface for every read and write.
export class DailyPuzzleGame {
    readonly game: DailyGame<unknown, unknown>;
    readonly model: unknown;
    readonly #fingerprint: string;
    state = $state.raw<unknown>(undefined);
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
    // the most recent hint step served for this puzzle (a mistake hint is not a step)
    lastHint = $state<ServedHint | undefined>(undefined);

    marks = $derived.by(() => this.game.marks(this.model, this.state));
    lit = $derived.by(() => this.game.lit?.(this.model, this.state) ?? new Set<number>());
    // rule violations plus the keys the server flagged in a mistake hint, for the board
    violations = $derived.by((): Violation[] => {
        const out = this.game.check(this.model, this.state);
        return this.mistakes.size > 0
            ? [...out, { keys: [...this.mistakes], kind: "mistake" }]
            : out;
    });
    solvedLocally = $derived.by(() => this.game.solved(this.model, this.state));

    #dirty = false;
    #saveTimer: number | undefined;
    #disposed = false;
    #onVisibility = () => {
        if (document.visibilityState === "hidden") this.flushSave();
    };

    constructor(
        private client: OpenChat,
        readonly puzzle: PublicDailyPuzzle,
        userState: DailyPuzzleUserState | undefined,
        private userId: string,
        game: DailyGame<unknown, unknown>,
    ) {
        this.game = game;
        this.model = game.parse(puzzle.description);
        this.#fingerprint = puzzleFingerprint(puzzle);
        this.state = this.#resume(userState);
        this.lastHint = [...(userState?.hints ?? [])].reverse().find((h) => !h.mistake);
        document.addEventListener("visibilitychange", this.#onVisibility);
    }

    dispose(): void {
        this.#disposed = true;
        document.removeEventListener("visibilitychange", this.#onVisibility);
        this.flushSave();
    }

    get userState(): DailyPuzzleUserState | undefined {
        return stateFor(dailyPuzzleStore.value, this.puzzle.gameId);
    }

    get started(): boolean {
        return this.userState?.startedAt !== undefined;
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
    #resume(userState: DailyPuzzleUserState | undefined): unknown {
        const empty = this.game.empty(this.model);
        if (userState?.startedAt === undefined) return empty;
        const local = readLocal(this.userId, this.puzzle.number);
        const serverAt = userState.gridSavedAt !== undefined ? Number(userState.gridSavedAt) : 0;
        const localAt = local?.savedAt ?? 0;
        const serverIsThis =
            userState.gameId === this.puzzle.gameId && userState.number === this.puzzle.number;
        if (local !== undefined && local.fingerprint === this.#fingerprint) {
            const replayed = local.filled.reduce(
                (s, [k, v]) => this.game.apply(this.model, s, k, v),
                empty,
            );
            // The local copy is written on every edit and the server copy a few seconds after,
            // stamped by the canister, so by timestamp the server always looks newer. Only the
            // local copy keeps the "no" marks, so when the two hold the same board it is the
            // same save seen from both ends, and the local copy is the fuller one.
            const same =
                serverIsThis && sameBytes(userState.grid, this.game.toBytes(this.model, replayed));
            if (localAt >= serverAt || same) {
                this.#lastMistake = local.mistake;
                return replayed;
            }
        }
        if (serverIsThis) {
            return this.game.fromBytes(this.model, userState.grid) ?? empty;
        }
        return empty;
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
        const level = this.nextHintLevel;
        const hintsLeft = this.hintsLeft;
        if (level === 1 && hintsLeft === 0) return { kind: "noneLeft" };
        const checksLeft = this.freeChecksLeft;
        return {
            kind: "hint",
            level,
            price: this.nextHintPrice,
            hintsLeft,
            ...(checksLeft < SHOW_CHECKS_LEFT_BELOW ? { checksLeft } : {}),
        };
    }

    get inputDisabled(): boolean {
        return (
            !this.started || this.submitting || this.busy || this.userState?.solved !== undefined
        );
    }

    tap(key: number): void {
        if (this.inputDisabled) return;
        const next = this.game.tap(this.model, this.state, key);
        if (next === this.state) return;
        this.state = next;
        this.#afterChange();
        this.#trimHint();
    }

    /** A board to clear: started, not solved, and holding at least one mark (#9361 invariant 4). */
    get canReset(): boolean {
        return !this.inputDisabled && this.#filled().length > 0;
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
        this.state = this.game.empty(this.model);
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
        const own = this.game.hintKeyStatus?.(this.model, this.state, key);
        if (own !== undefined) return own;
        if (!this.#markable(key)) return "context";
        return filled.has(key) ? "done" : "todo";
    }

    // A hint's highlight and sentence describe a position, and once the player has made the
    // moves it asked for they describe the past: left up, they read as the game telling you to
    // do something you have already done. So the highlight only ever shows what is still to
    // do, cells drop out of it as they are marked, and once nothing markable is left the whole
    // hint goes on the player's next edit. Below level 3 the server withholds the conclusions,
    // so "done" cannot be read from the values; it is read from the keys the highlight named
    // (#9334 invariant 61). Only a player edit trims, never the level 3 reveal applying its own
    // conclusions, or the highlight would vanish the instant it appeared.
    #trimHint(): void {
        if (this.focus.size === 0) return;
        const filled = new Set(this.#filled().map(([k]) => k));
        const last = this.lastHint;
        const status = (k: number) => this.#keyStatus(k, filled);
        // What the player was asked to mark: the cells the deduction looked at, less the subject
        // the sentence points at (see #applyHint) and anything that takes no mark
        const subject = new Set(last?.hint.target ?? []);
        const asked = [...this.focus].filter((k) => !subject.has(k) && status(k) !== "context");
        const remaining = asked.filter((k) => status(k) === "todo");
        // A reveal has nothing left to ask for, so any edit after it, including undoing a cell it
        // filled, retires it: kept, its caption would describe a fill no longer on the board
        const revealed = last !== undefined && last.level >= 3;
        if (revealed || (last !== undefined && this.#concluded(last)) || remaining.length === 0) {
            this.focus = new Set();
            this.target = new Set();
            this.#caption = undefined;
            return;
        }
        this.focus = new Set([...this.focus].filter((k) => subject.has(k) || status(k) !== "done"));
        this.target = new Set([...this.target].filter((k) => this.focus.has(k)));
    }

    #markable(key: number): boolean {
        return this.game.tap(this.model, this.state, key) !== this.state;
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
            this.#filled(),
            this.#lastMistake,
        );
        if (this.#saveTimer === undefined) {
            this.#saveTimer = window.setTimeout(() => {
                this.#saveTimer = undefined;
                this.flushSave();
            }, SERVER_SAVE_INTERVAL);
        }
        if (this.solvedLocally) {
            this.submit();
        }
    }

    #bytes(): Uint8Array {
        return this.game.toBytes(this.model, this.state);
    }

    flushSave(): void {
        if (!this.#dirty) return;
        if (!this.started || this.userState?.solved !== undefined) return;
        this.#dirty = false;
        this.client.dailyPuzzleSaveGrid(this.puzzle.gameId, this.#bytes());
    }

    submit(): Promise<void> {
        if (this.submitting || !this.started) return Promise.resolve();
        if (this.userState?.solved !== undefined) return Promise.resolve();
        this.submitting = true;
        this.#dirty = false;
        return this.client
            .dailyPuzzleSubmit(this.puzzle.gameId, this.#bytes())
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

    // Level to ask for on the next hint tap: the current step's next level while its
    // conclusions are still open, otherwise level 1 of a new step.
    get nextHintLevel(): number {
        const last = this.lastHint;
        if (last !== undefined && !this.#concluded(last) && last.level < 3) {
            return last.level + 1;
        }
        return 1;
    }

    // What the server will charge for the next tap: a new step at level 1 costs level 1; upgrading
    // the served step to the next level costs the difference between the two levels, as the
    // engine prices it, so climbing the ladder is never dearer than jumping to the top.
    get nextHintPrice(): number {
        const level = this.nextHintLevel;
        const price = (l: number) => this.puzzle.hintPrices[l - 1] ?? 0;
        return level > 1 ? price(level) - price(level - 1) : price(level);
    }

    #filled(): [number, number][] {
        return this.game.filled(this.model, this.state);
    }

    #filledKey(): string {
        return JSON.stringify(this.#filled());
    }

    // Same test the server applies when it picks the next step: a step is done once its
    // positive conclusions are on the board. Negative ones ("no line", "grass") are optional
    // notes the player may never mark, so requiring them would strand us on a finished step.
    #concluded(hint: ServedHint): boolean {
        // Below level 3 the server withholds the conclusions, so an empty list means "not
        // revealed", not "all satisfied". Reading it as satisfied would pin the next tap at
        // level 1 forever and the hint button would look dead.
        if (hint.hint.conclusions.length === 0) return false;
        const filled = this.#filled();
        return hint.hint.conclusions
            .filter(([, v]) => v !== 0)
            .every(([k, v]) => filled.some(([fk, fv]) => fk === k && fv === v));
    }

    hint(): Promise<void> {
        if (this.inputDisabled || this.busy) return Promise.resolve();
        // The answer to these marks is already on screen, and asking again would spend a free
        // check on it (#9360 invariant 1)
        if (this.mistakeStands) return Promise.resolve();
        const last = this.lastHint;
        // A fully revealed step whose conclusions were undone: re-apply it, no charge
        if (last !== undefined && last.level === 3 && !this.#concluded(last)) {
            this.#applyHint(last);
            return Promise.resolve();
        }
        this.busy = true;
        return this.#requestHint(this.nextHintLevel, this.nextHintPrice, false).finally(() => {
            this.busy = false;
        });
    }

    // The server quotes the right price back on a mismatch (the step it picked, and what this
    // user has already bought, are its to know), so one retry with that quote is the honest
    // move; a second mismatch is an error. A quote above the price on the button is never paid:
    // the player agreed to what the button said, not to whatever the server asks (#9517
    // invariant 2).
    #requestHint(level: number, price: number, retried: boolean): Promise<void> {
        return this.client
            .dailyPuzzleHint(this.puzzle.gameId, level, this.#filled(), price)
            .then((resp) => {
                if (resp.kind === "error") {
                    const quoted = Number(resp.message);
                    if (
                        resp.code === ErrorCode.PriceMismatch &&
                        !retried &&
                        Number.isFinite(quoted) &&
                        quoted <= price
                    ) {
                        return this.#requestHint(level, quoted, true);
                    }
                    toastStore.showFailureToast(
                        i18nKey(
                            resp.code === ErrorCode.Throttled
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
                        this.#filled(),
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

    #applyHint(hint: ServedHint): void {
        if (hint.level >= 3) {
            // The reveal fills the cells itself, so afterwards there is nothing to ask the player
            // for: the caption says what was done and the filled cells sit in the faint context
            // highlight, never the "mark this" one (#9360 invariant 6). Cleared on the next edit.
            this.state = hint.hint.conclusions.reduce(
                (s, [k, v]) => this.game.apply(this.model, s, k, v),
                this.state,
            );
            this.focus = new Set([...hint.hint.focus, ...hint.hint.conclusions.map(([k]) => k)]);
            this.target = new Set();
            this.#caption = i18nKey("dailyPuzzle.revealed");
            this.#afterChange();
            return;
        }
        // Cells the player has already marked are not shown: the hint is about what is left.
        // The target is the sentence's subject ("this cell can only be lit from one place"),
        // and below level 3 the server sends it only when it names no concluded key, so it is
        // never the move asked for: it stays in the highlight whether marked or not, or the
        // sentence would sit on the answer cell instead of the cell it describes.
        const filled = new Set(this.#filled().map(([k]) => k));
        const subject = new Set(hint.hint.target);
        const show = (keys: number[]) =>
            keys.filter((k) => subject.has(k) || this.#keyStatus(k, filled) !== "done");
        this.focus = new Set([...show(hint.hint.focus), ...subject]);
        // no target: point at everything in focus
        this.target = subject.size > 0 ? subject : new Set(this.focus);
        this.#caption =
            hint.level >= 2
                ? i18nKey(`${gameI18nPrefix(this.puzzle.gameId)}.technique.${hint.hint.technique}`)
                : undefined;
    }

    resultCard(): DailyResultContent | undefined {
        const solved = this.userState?.solved;
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
        const solved = this.userState?.solved;
        return solved !== undefined && solved.solveTimeMs >= this.puzzle.minCardedSolveMs;
    }

    share(): void {
        const card = this.resultCard();
        if (card !== undefined) publish("shareDailyResult", card);
    }
}
