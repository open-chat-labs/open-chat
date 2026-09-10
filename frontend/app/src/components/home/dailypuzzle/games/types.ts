import type { Violation } from "@client";

// Props every game's Board.svelte accepts. The shell passes its model/state through opaquely;
// each Board narrows M and S to its own game's types.
export type BoardProps<M, S> = {
    model: M;
    state: S;
    /** key -> mark name, from DailyGame.marks(). */
    marks: Map<number, string>;
    /** Derived highlight, from DailyGame.lit() (empty for games without one). */
    lit: Set<number>;
    /** DailyGame.check() plus a `{ kind: "mistake" }` entry for keys the server flagged. */
    violations: Violation[];
    /** Every key the current hint step looked at (context, painted faintly). Superset of target. */
    focus: Set<number>;
    /** The keys the hint sentence points at ("this cell"), painted strongly. */
    target: Set<number>;
    onTap: (key: number) => void;
    /** Before the puzzle is started: draw without marks, in a muted style. */
    greyed?: boolean;
    disabled?: boolean;
};

export type PictogramProps<M> = { model: M };

/**
 * One still of a game's "how to play" demo. The frame's marks are applied to an empty grid with
 * the game's own `apply`, so what the demo paints (including a deliberate mistake going red)
 * comes from the same rule checker that runs during play. Nothing here is hand-drawn.
 */
export type DemoFrame = {
    /** (key, value) pairs to place on an empty grid, in the backend's conclusion encoding. */
    marks: [number, number][];
    /** i18n key under the game's prefix, e.g. "demo.1". */
    caption: string;
    /** Keys the caption points at; drawn with the hint highlight. */
    target?: number[];
};

/** A game's demo: a tiny hand-written puzzle plus the stills to step through. */
export type DemoSpec = {
    /** Wire-format description, parsed with the game's own `parse`. */
    description: Uint8Array;
    frames: DemoFrame[];
};
