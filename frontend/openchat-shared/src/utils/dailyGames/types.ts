// The contract every daily puzzle game implements on the client. The shell (DailyPuzzleGame in
// the app) only ever talks to a game through this interface: it holds an opaque `model` (the
// parsed puzzle) and `state` (the user's marks) and never looks inside either.
//
// M = parsed description (dimensions + givens). S = the user's marks. Both are treated as
// immutable values: `tap` and `apply` return a new S rather than mutating the one passed in.

/**
 * One renderable tap target. Coordinates are in cell units with the top-left cell at (0, 0);
 * a cell is `{ x, y, w: 1, h: 1 }`, an edge is a thin rect straddling the boundary it sits on
 * (see gridSvg.ts in the app for the helpers that turn these into SVG rects). A vertex is a
 * zero-size point at a grid corner (`{ x, y, w: 0, h: 0 }`), never a tap target: it lets a
 * board paint hint focus on a corner clue.
 */
export type GameElement = {
    key: number;
    kind: "cell" | "edge" | "vertex";
    x: number;
    y: number;
    w: number;
    h: number;
    /** A given drawn on the element, e.g. a clue number. */
    label?: string;
};

/**
 * A broken rule over some keys. `kind` is game-defined and only the game's Board interprets it;
 * the shell also passes `"mistake"` for keys the server flagged in a mistake hint.
 */
export type Violation = { keys: number[]; kind: string };

export interface DailyGame<M, S> {
    /** GameId as the backend names it, e.g. "light_up". */
    id: string;
    /** Dimensions + givens. Throws on bad bytes. */
    parse(description: Uint8Array): M;
    /** No marks. */
    empty(model: M): S;
    /** Renderable tap targets. */
    elements(model: M): GameElement[];
    /** Cycle the mark on `key`; returns `state` unchanged for keys that take no mark. */
    tap(model: M, state: S, key: number): S;
    /** Set a hint conclusion (key, value) as the backend encodes it. */
    apply(model: M, state: S, key: number, value: number): S;
    /**
     * (key, value) pairs the user has committed, both positive and "no" marks, in the backend's
     * conclusion encoding. Sent as `filled` with hint requests so satisfied conclusions are
     * skipped, and used by the shell to save and restore marks locally.
     */
    filled(model: M, state: S): Array<[number, number]>;
    /** Broken rules, for painting. */
    check(model: M, state: S): Violation[];
    /** No violations and complete. */
    solved(model: M, state: S): boolean;
    /** Canonical submission bytes; the server compares them to the solution byte for byte. */
    toBytes(model: M, state: S): Uint8Array;
    /** Resume from saved submission bytes; undefined if they do not fit this model. */
    fromBytes(model: M, bytes: Uint8Array): S | undefined;
    /** key -> visual mark name for the Board. Keys with no mark are absent. */
    marks(model: M, state: S): Map<number, string>;
    /** Optional derived highlight (Light Up beams). */
    lit?(model: M, state: S): Set<number>;
}
