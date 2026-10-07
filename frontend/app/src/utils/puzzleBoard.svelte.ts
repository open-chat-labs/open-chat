import type {
    DailyGame,
    GameElement,
    HintCaption,
    HintKeyStatus,
    HintStep,
    Violation,
} from "@client";
import type { Component } from "svelte";
import type {
    BoardProps,
    BoardPropsFor,
    PictogramProps,
    PictogramPropsFor,
} from "../components/home/dailypuzzle/games/types";

/**
 * One puzzle's board as everything outside a game sees it: what to draw, and moves to make on
 * it. The model and the marks stay inside, so no code outside the game can hand one game's
 * state to another game's functions. `Board` and `Pictogram` are the game's own components;
 * hand them this same board and nothing else (`<board.Board {board} />`), see `bindBoard`.
 */
export interface PuzzleBoard {
    readonly Board: Component<BoardPropsFor<PuzzleBoard>>;
    readonly Pictogram: Component<PictogramPropsFor<PuzzleBoard>>;
    /** Renderable tap targets. */
    readonly elements: GameElement[];
    /** key -> visual mark name. Keys with no mark are absent. */
    readonly marks: Map<number, string>;
    /** Derived highlight (Light Up beams); empty for games without one. */
    readonly lit: Set<number>;
    /** Broken rules. */
    readonly violations: Violation[];
    /** No violations and complete. */
    readonly solved: boolean;
    /** Cycle the mark on `key`; false when the key takes no mark and nothing changed. */
    tap(key: number): boolean;
    /** Whether a tap on `key` would change the board. */
    takesMark(key: number): boolean;
    /** Remove every mark. */
    clear(): void;
    /** Replace the marks with saved submission bytes; false (and no change) if they do not fit. */
    load(bytes: Uint8Array): boolean;
    /** The committed (key, value) pairs, "no" marks included; see DailyGame.filled. */
    filled(): [number, number][];
    /** The pairs to send with a hint request; see DailyGame.hintFilled. */
    hintFilled(): [number, number][];
    /** Canonical submission bytes. */
    toBytes(): Uint8Array;
    /** The game's own say on a hint key, when it has one; see DailyGame.hintKeyStatus. */
    hintKeyStatus(key: number): HintKeyStatus | undefined;
    /** The game's own sentence for a step, when it has one; see DailyGame.hintCaption. */
    hintCaption(step: HintStep): HintCaption | undefined;
}

/**
 * A board on `description` with `filled` already marked, through `game`. Throws on bad bytes.
 *
 * This is the one cast in the daily puzzle code. Everything a PuzzleBoard does with its model and
 * state is checked, inside BoundBoard<M, S>. What TypeScript cannot check is the hand-off to the
 * game's own components: seen as a PuzzleBoard, the board's M and S have no name, so nothing
 * can say that `board.Board` takes `board` and not some other game's board. The screens only
 * ever write `<board.Board {board} />`.
 */
export function bindBoard<M, S>(
    game: DailyGame<M, S>,
    Board: Component<BoardProps<M, S>>,
    Pictogram: Component<PictogramProps<M>>,
    description: Uint8Array,
    filled: [number, number][] = [],
): PuzzleBoard {
    return new BoundBoard(game, Board, Pictogram, description, filled) as unknown as PuzzleBoard;
}

// The one place a game's model and state live. Generic, so they can only ever meet the
// functions of the game that made them. Checked against all of PuzzleBoard but the two
// components (see bindBoard).
class BoundBoard<M, S> implements Omit<PuzzleBoard, "Board" | "Pictogram"> {
    readonly model: M;
    state: S;
    readonly elements: GameElement[];
    marks = $derived.by(() => this.game.marks(this.model, this.state));
    lit = $derived.by(() => this.game.lit?.(this.model, this.state) ?? new Set<number>());
    violations = $derived.by(() => this.game.check(this.model, this.state));
    solved = $derived.by(() => this.game.solved(this.model, this.state));

    constructor(
        private readonly game: DailyGame<M, S>,
        readonly Board: Component<BoardProps<M, S>>,
        readonly Pictogram: Component<PictogramProps<M>>,
        description: Uint8Array,
        filled: [number, number][] = [],
    ) {
        const model = game.parse(description);
        this.model = model;
        this.elements = game.elements(model);
        this.state = $state.raw(
            filled.reduce((s, [k, v]) => game.apply(model, s, k, v), game.empty(model)),
        );
    }

    tap(key: number): boolean {
        const next = this.game.tap(this.model, this.state, key);
        if (next === this.state) return false;
        this.state = next;
        return true;
    }

    takesMark(key: number): boolean {
        return this.game.tap(this.model, this.state, key) !== this.state;
    }

    clear(): void {
        this.state = this.game.empty(this.model);
    }

    load(bytes: Uint8Array): boolean {
        const loaded = this.game.fromBytes(this.model, bytes);
        if (loaded === undefined) return false;
        this.state = loaded;
        return true;
    }

    filled(): [number, number][] {
        return this.game.filled(this.model, this.state);
    }

    hintFilled(): [number, number][] {
        return this.game.hintFilled?.(this.model, this.state) ?? this.filled();
    }

    toBytes(): Uint8Array {
        return this.game.toBytes(this.model, this.state);
    }

    hintKeyStatus(key: number): HintKeyStatus | undefined {
        return this.game.hintKeyStatus?.(this.model, this.state, key);
    }

    hintCaption(step: HintStep): HintCaption | undefined {
        return this.game.hintCaption?.(this.model, this.state, step);
    }
}
