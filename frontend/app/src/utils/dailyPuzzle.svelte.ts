import {
    descriptionToHex,
    type DailyGame,
    type DailyPuzzleUserState,
    type DailyResultContent,
    type OpenChat,
    type PublicDailyPuzzle,
    type ResourceKey,
    type ServedHint,
    type Violation,
    ANON_USER_ID,
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

// The user's marks as `filled()` pairs, replayed through `apply` on resume. Unlike the server
// copy (submission bytes) this keeps "no" marks. `fingerprint` ties the marks to the exact
// puzzle they were saved against (see puzzleFingerprint).
type LocalMarks = { filled: [number, number][]; savedAt: number; fingerprint: string };

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
): void {
    if (userId === ANON_USER_ID) return;
    try {
        const value: LocalMarks = { filled, savedAt: Date.now(), fingerprint };
        localStorage.setItem(localKey(userId, number), JSON.stringify(value));
    } catch {
        // storage unavailable: the server copy still exists
    }
}

export function formatSolveTime(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
    return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

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
    mistakes = $state<Set<number>>(new Set());
    caption = $state<ResourceKey | undefined>(undefined);
    busy = $state(false);
    submitting = $state(false);
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

    get entryFee(): number {
        const state = this.userState;
        return this.puzzle.firstPlayFree && !(state?.hasSolvedBefore ?? false)
            ? 0
            : this.puzzle.entryFee;
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
        if (local !== undefined && local.fingerprint === this.#fingerprint && localAt >= serverAt) {
            return local.filled.reduce((s, [k, v]) => this.game.apply(this.model, s, k, v), empty);
        }
        if (userState.gameId === this.puzzle.gameId && userState.number === this.puzzle.number) {
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

    get inputDisabled(): boolean {
        return (
            !this.started || this.submitting || this.busy || this.userState?.solved !== undefined
        );
    }

    tap(key: number): void {
        if (this.inputDisabled) return;
        const next = this.game.tap(this.model, this.state, key);
        if (next === this.state) return;
        if (this.mistakes.size > 0) {
            this.mistakes = new Set();
            this.caption = undefined;
        }
        this.state = next;
        this.#afterChange();
        this.#dropHintOnceDone(key);
    }

    // A hint's highlight and sentence describe a position, and once the player has made the
    // move they describe the past: left up, they read as the game telling you to do something
    // you have already done. Only a player edit can trigger this, never the level 3 reveal
    // applying its own conclusions, or the highlight would vanish the instant it appeared.
    //
    // Below level 3 the server withholds the conclusions, so "have they done it?" cannot be
    // answered from the values. It can be answered from the keys, which the highlight has
    // already shown them: the hint is done once every cell it pointed at carries a mark. Some
    // techniques instead point at a clue or a dot the player can never mark (Loopy's dot rules,
    // Slant's corner numbers); there, the move they just made inside the highlighted region is
    // the signal.
    #dropHintOnceDone(tapped: number): void {
        const last = this.lastHint;
        if (last === undefined || this.focus.size === 0) return;

        const filled = new Set(this.#filled().map(([k]) => k));
        const pointed = last.hint.target.length > 0 ? last.hint.target : last.hint.focus;
        const allPointedMarked = pointed.length > 0 && pointed.every((k) => filled.has(k));
        const pointedIsUnmarkable = !pointed.some((k) => filled.has(k));

        if (
            this.#concluded(last) ||
            allPointedMarked ||
            (pointedIsUnmarkable && this.focus.has(tapped))
        ) {
            this.focus = new Set();
            this.target = new Set();
            this.caption = undefined;
        }
    }

    #afterChange(): void {
        this.#dirty = true;
        writeLocal(this.userId, this.puzzle.number, this.#fingerprint, this.#filled());
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

    get nextHintPrice(): number {
        return this.puzzle.hintPrices[this.nextHintLevel - 1] ?? 0;
    }

    #filled(): [number, number][] {
        return this.game.filled(this.model, this.state);
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
        const last = this.lastHint;
        // A fully revealed step whose conclusions were undone: re-apply it, no charge
        if (last !== undefined && last.level === 3 && !this.#concluded(last)) {
            this.#applyHint(last);
            return Promise.resolve();
        }
        const level = this.nextHintLevel;
        const price = this.nextHintPrice;
        this.busy = true;
        return this.client
            .dailyPuzzleHint(this.puzzle.gameId, level, this.#filled(), price)
            .then((resp) => {
                if (resp.kind === "error") {
                    toastStore.showFailureToast(i18nKey("dailyPuzzle.failedHint"), resp);
                    return;
                }
                if (resp.hint.mistake) {
                    this.mistakes = new Set(resp.hint.hint.focus);
                    this.focus = new Set();
                    this.target = new Set();
                    this.caption = i18nKey("dailyPuzzle.mistake");
                    return;
                }
                this.lastHint = resp.hint;
                this.mistakes = new Set();
                this.#applyHint(resp.hint);
            })
            .catch((err) => {
                toastStore.showFailureToast(i18nKey("dailyPuzzle.failedHint"), err);
            })
            .finally(() => {
                this.busy = false;
            });
    }

    #applyHint(hint: ServedHint): void {
        this.focus = new Set(hint.hint.focus);
        // legacy hints carry no target: point at everything in focus
        this.target = new Set(hint.hint.target.length > 0 ? hint.hint.target : hint.hint.focus);
        this.caption =
            hint.level >= 2
                ? i18nKey(`${gameI18nPrefix(this.puzzle.gameId)}.technique.${hint.hint.technique}`)
                : undefined;
        if (hint.level >= 3) {
            this.state = hint.hint.conclusions.reduce(
                (s, [k, v]) => this.game.apply(this.model, s, k, v),
                this.state,
            );
            this.#afterChange();
        }
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
