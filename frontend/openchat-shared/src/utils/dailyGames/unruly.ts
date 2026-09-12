// Unruly (Binary Puzzle / Binairo) rule checker, a port of backend/libraries/unruly
// `check_rules`.
//
// Wire format. Description: [version = 1, width, height, width*height given bytes row-major]
// where 0 = blank, 1 = the first value, 2 = the second. Grid: width*height cell bytes
// row-major, each 1 or 2 in a submission (0 while the grid is still being filled). The givens
// are part of the grid, so the submission repeats them: the server compares byte for byte
// against a solution that is 1 or 2 everywhere. Cell key = y*width+x, and conclusion values are
// 1 or 2 — a hint never says "this cell is empty", so nothing in this game encodes an empty
// conclusion.
//
// The user's state holds only the cells the player filled in: a given's slot stays 0 there and
// its value is merged back in by `unrulyGrid` whenever the rules are checked or bytes are made.
// That keeps givens immutable and keeps `filled` to the player's own marks.

import type { DailyGame, GameElement, Violation } from "./types";

/** 0 empty, 1 the first value, 2 the second. */
export type UnrulyCell = 0 | 1 | 2;
export type UnrulyDescription = {
    width: number;
    height: number;
    /** width*height row-major; 0 = blank, 1 or 2 = a given. */
    givens: UnrulyCell[];
};
export type UnrulyViolation =
    /** Three equal values in a row, listed left to right or top to bottom. */
    | { kind: "run"; cells: number[]; value: number }
    /** This row holds more of `value` than the width/2 it is allowed. */
    | { kind: "row_count"; row: number; value: number; count: number; cells: number[] }
    /** This column holds more of `value` than the height/2 it is allowed. */
    | { kind: "column_count"; column: number; value: number; count: number; cells: number[] };

const FORMAT_VERSION = 1;
export const UNRULY_EMPTY = 0;
export const UNRULY_VALUE_A = 1;
export const UNRULY_VALUE_B = 2;

function malformed(): Error {
    return new Error("malformed unruly description");
}

export function parseDescription(bytes: Uint8Array | number[]): UnrulyDescription {
    if (bytes.length < 3 || bytes[0] !== FORMAT_VERSION) {
        throw malformed();
    }
    const width = bytes[1];
    const height = bytes[2];
    if (width < 2 || height < 2 || width % 2 !== 0 || height % 2 !== 0) {
        throw malformed();
    }
    if (bytes.length !== 3 + width * height) {
        throw malformed();
    }
    const givens: UnrulyCell[] = [];
    for (let i = 3; i < bytes.length; i++) {
        const b = bytes[i];
        if (b !== UNRULY_EMPTY && b !== UNRULY_VALUE_A && b !== UNRULY_VALUE_B) {
            throw malformed();
        }
        givens.push(b);
    }
    return { width, height, givens };
}

/** No marks: the givens are not part of the state, so this is empty everywhere. */
export function emptyGrid(desc: UnrulyDescription): UnrulyCell[] {
    return new Array<UnrulyCell>(desc.width * desc.height).fill(0);
}

export function isGiven(desc: UnrulyDescription, key: number): boolean {
    return desc.givens[key] !== undefined && desc.givens[key] !== UNRULY_EMPTY;
}

/** The givens with the player's marks laid over them: the grid the rules are about. */
export function unrulyGrid(desc: UnrulyDescription, state: UnrulyCell[]): UnrulyCell[] {
    const n = desc.width * desc.height;
    return desc.givens.map((g, i) =>
        g !== UNRULY_EMPTY ? g : state.length === n ? state[i] : UNRULY_EMPTY,
    );
}

/** How many of each value a row holds when complete. */
export function unrulyRowTarget(desc: UnrulyDescription): number {
    return desc.width / 2;
}

/** How many of each value a column holds when complete. */
export function unrulyColumnTarget(desc: UnrulyDescription): number {
    return desc.height / 2;
}

// Mirrors the Rust check_rules exactly, `grid` being the merged grid. Empty cells are never a
// violation (the grid is merely incomplete), and nor is a line short of a value: only a line
// holding MORE of a value than it is allowed is wrong, and that can never be undone by filling
// the rest in, so the board never reddens a line the player could still bring good. A grid of
// the wrong length counts as empty.
export function checkRules(desc: UnrulyDescription, grid: UnrulyCell[]): UnrulyViolation[] {
    const { width: w, height: h } = desc;
    const n = w * h;
    const g: UnrulyCell[] = grid.length === n ? grid : emptyGrid(desc);
    const out: UnrulyViolation[] = [];

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = y * w + x;
            const v = g[i];
            if (v === UNRULY_EMPTY) continue;
            if (x + 2 < w && g[i + 1] === v && g[i + 2] === v) {
                out.push({ kind: "run", cells: [i, i + 1, i + 2], value: v });
            }
            if (y + 2 < h && g[i + w] === v && g[i + 2 * w] === v) {
                out.push({ kind: "run", cells: [i, i + w, i + 2 * w], value: v });
            }
        }
    }

    const rowTarget = unrulyRowTarget(desc);
    for (const value of [UNRULY_VALUE_A, UNRULY_VALUE_B]) {
        for (let row = 0; row < h; row++) {
            const cells: number[] = [];
            for (let x = 0; x < w; x++) {
                if (g[row * w + x] === value) cells.push(row * w + x);
            }
            if (cells.length > rowTarget) {
                out.push({ kind: "row_count", row, value, count: cells.length, cells });
            }
        }
    }

    const columnTarget = unrulyColumnTarget(desc);
    for (const value of [UNRULY_VALUE_A, UNRULY_VALUE_B]) {
        for (let column = 0; column < w; column++) {
            const cells: number[] = [];
            for (let y = 0; y < h; y++) {
                if (g[y * w + column] === value) cells.push(y * w + column);
            }
            if (cells.length > columnTarget) {
                out.push({ kind: "column_count", column, value, count: cells.length, cells });
            }
        }
    }

    return out;
}

/** `grid` is the merged grid: every cell filled and no rule broken. */
export function isSolved(desc: UnrulyDescription, grid: UnrulyCell[]): boolean {
    return (
        grid.length === desc.width * desc.height &&
        grid.every((c) => c !== UNRULY_EMPTY) &&
        checkRules(desc, grid).length === 0
    );
}

export function toGridBytes(grid: UnrulyCell[]): Uint8Array {
    return Uint8Array.from(grid);
}

/** Given slots are dropped: the state only ever holds the player's own marks. */
export function fromGridBytes(desc: UnrulyDescription, bytes: Uint8Array | number[]): UnrulyCell[] {
    return Array.from(bytes, (b, i) =>
        isGiven(desc, i) || (b !== UNRULY_VALUE_A && b !== UNRULY_VALUE_B) ? 0 : (b as UnrulyCell),
    );
}

export function cycleCell(cell: UnrulyCell): UnrulyCell {
    switch (cell) {
        case UNRULY_EMPTY:
            return UNRULY_VALUE_A;
        case UNRULY_VALUE_A:
            return UNRULY_VALUE_B;
        case UNRULY_VALUE_B:
            return UNRULY_EMPTY;
    }
}

// Violation kinds for the board: "run" over the three cells that repeat, "row_count" and
// "column_count" over the cells of the value the line has too many of.
function toViolations(violations: UnrulyViolation[]): Violation[] {
    return violations.map((v) => ({ keys: v.cells, kind: v.kind }));
}

export const unruly: DailyGame<UnrulyDescription, UnrulyCell[]> = {
    id: "unruly",
    parse: parseDescription,
    empty: emptyGrid,
    elements(desc): GameElement[] {
        const out: GameElement[] = [];
        for (let i = 0; i < desc.width * desc.height; i++) {
            out.push({
                key: i,
                kind: "cell",
                x: i % desc.width,
                y: Math.floor(i / desc.width),
                w: 1,
                h: 1,
            });
        }
        return out;
    },
    tap(desc, state, key) {
        if (key < 0 || key >= desc.width * desc.height || isGiven(desc, key)) return state;
        const next = [...state];
        next[key] = cycleCell(next[key]);
        return next;
    },
    apply(desc, state, key, value) {
        if (key < 0 || key >= desc.width * desc.height || isGiven(desc, key)) return state;
        if (value !== UNRULY_VALUE_A && value !== UNRULY_VALUE_B) return state;
        const next = [...state];
        next[key] = value;
        return next;
    },
    filled(_desc, state) {
        const out: [number, number][] = [];
        state.forEach((c, i) => {
            if (c !== UNRULY_EMPTY) out.push([i, c]);
        });
        return out;
    },
    check(desc, state) {
        return toViolations(checkRules(desc, unrulyGrid(desc, state)));
    },
    solved(desc, state) {
        return isSolved(desc, unrulyGrid(desc, state));
    },
    toBytes(desc, state) {
        return toGridBytes(unrulyGrid(desc, state));
    },
    fromBytes(desc, bytes) {
        return bytes.length === desc.width * desc.height ? fromGridBytes(desc, bytes) : undefined;
    },
    marks(desc, state) {
        const out = new Map<number, string>();
        desc.givens.forEach((g, i) => {
            if (g === UNRULY_VALUE_A) out.set(i, "given_a");
            else if (g === UNRULY_VALUE_B) out.set(i, "given_b");
            else if (state[i] === UNRULY_VALUE_A) out.set(i, "a");
            else if (state[i] === UNRULY_VALUE_B) out.set(i, "b");
        });
        return out;
    },
};
