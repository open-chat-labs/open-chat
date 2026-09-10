// Loopy (Slitherlink) rule checker, a port of backend/libraries/loopy `check_rules`, square
// grid only.
//
// Wire format. Description: [version = 1, width, height, width*height clue bytes row-major]
// where 0xFF = no clue, else 0..3. Grid: one byte per edge, 1 = line, 0 = no line, every
// horizontal edge first ((height+1) rows of width, row-major) then every vertical edge (height
// rows of width+1). So the top edge of cell (x, y) is y*width+x and its left edge is
// (height+1)*width + y*(width+1) + x. Edge key = that index. Cell key = edge count + cell index
// (row-major) and dot key = edge count + width*height + dot index (row-major over the
// (width+1)*(height+1) dots); neither is ever a conclusion, hint focus and target use them to
// name the clue or dot a deduction is about.

import type { DailyGame, GameElement, Violation } from "./types";

/** 0 unknown, 1 line, 2 no line (an x). */
export type LoopyEdge = 0 | 1 | 2;
export type LoopyDescription = {
    width: number;
    height: number;
    /** width*height row-major; undefined = no clue. */
    clues: (number | undefined)[];
};
export type LoopyViolation =
    | { kind: "clue_count"; cell: number; expected: number; lines: number; possible: number }
    /** `edges` are the lines at the dot. */
    | { kind: "dot_degree"; dot: number; degree: number; edges: number[] }
    | { kind: "extra_loop"; edges: number[] };

const FORMAT_VERSION = 1;
const NO_CLUE = 0xff;
export const LOOPY_LINE = 1;
export const LOOPY_CROSS = 2;

function malformed(): Error {
    return new Error("malformed loopy description");
}

export function parseDescription(bytes: Uint8Array | number[]): LoopyDescription {
    if (bytes.length < 3 || bytes[0] !== FORMAT_VERSION) {
        throw malformed();
    }
    const width = bytes[1];
    const height = bytes[2];
    if (width < 1 || height < 1 || bytes.length !== 3 + width * height) {
        throw malformed();
    }
    const clues: (number | undefined)[] = [];
    for (let i = 3; i < bytes.length; i++) {
        const b = bytes[i];
        if (b === NO_CLUE) {
            clues.push(undefined);
        } else if (b <= 3) {
            clues.push(b);
        } else {
            throw malformed();
        }
    }
    return { width, height, clues };
}

function horizontals(desc: LoopyDescription): number {
    return (desc.height + 1) * desc.width;
}

/** Number of edges, and the offset of cell keys. */
export function loopyEdgeCount(desc: LoopyDescription): number {
    return horizontals(desc) + desc.height * (desc.width + 1);
}

export function loopyCellKey(desc: LoopyDescription, cell: number): number {
    return loopyEdgeCount(desc) + cell;
}

/** Dots are row-major over (width+1) * (height+1), so their keys sit above the cell keys. */
export function loopyDotKey(desc: LoopyDescription, dot: number): number {
    return loopyEdgeCount(desc) + desc.width * desc.height + dot;
}

/** Horizontal edge along the top of cell (x, y); y may equal height. */
function hedge(desc: LoopyDescription, x: number, y: number): number {
    return y * desc.width + x;
}

/** Vertical edge along the left of cell (x, y); x may equal width. */
function vedge(desc: LoopyDescription, x: number, y: number): number {
    return horizontals(desc) + y * (desc.width + 1) + x;
}

function dot(desc: LoopyDescription, x: number, y: number): number {
    return y * (desc.width + 1) + x;
}

/** Edges of a cell clockwise from the top: top, right, bottom, left. */
export function loopyCellEdges(desc: LoopyDescription, cell: number): [number, number, number, number] {
    const x = cell % desc.width;
    const y = Math.floor(cell / desc.width);
    return [hedge(desc, x, y), vedge(desc, x + 1, y), hedge(desc, x, y + 1), vedge(desc, x, y)];
}

/** Edges at a dot clockwise from the top; two at a corner, three on a border, four inside. */
function dotEdges(desc: LoopyDescription, d: number): number[] {
    const { width: w, height: h } = desc;
    const x = d % (w + 1);
    const y = Math.floor(d / (w + 1));
    const out: number[] = [];
    if (y > 0) out.push(vedge(desc, x, y - 1));
    if (x < w) out.push(hedge(desc, x, y));
    if (y < h) out.push(vedge(desc, x, y));
    if (x > 0) out.push(hedge(desc, x - 1, y));
    return out;
}

/** The two dots an edge joins: (left, right) or (top, bottom). */
function edgeDots(desc: LoopyDescription, e: number): [number, number] {
    const nh = horizontals(desc);
    if (e < nh) {
        const x = e % desc.width;
        const y = Math.floor(e / desc.width);
        return [dot(desc, x, y), dot(desc, x + 1, y)];
    }
    const r = e - nh;
    const x = r % (desc.width + 1);
    const y = Math.floor(r / (desc.width + 1));
    return [dot(desc, x, y), dot(desc, x, y + 1)];
}

export function emptyGrid(desc: LoopyDescription): LoopyEdge[] {
    return new Array<LoopyEdge>(loopyEdgeCount(desc)).fill(0);
}

class Dsf {
    private parent: number[];

    constructor(n: number) {
        this.parent = Array.from({ length: n }, (_, i) => i);
    }

    find(i: number): number {
        while (this.parent[i] !== i) {
            this.parent[i] = this.parent[this.parent[i]];
            i = this.parent[i];
        }
        return i;
    }

    merge(a: number, b: number): void {
        this.parent[this.find(a)] = this.find(b);
    }
}

type Analysis = {
    violations: LoopyViolation[];
    /** Lines around each cell. */
    cellLines: number[];
    /** Every dot has zero or two lines. */
    closed: boolean;
    /** Only computed when closed: the edges of each loop, in order of first appearance. */
    loops: number[][];
};

// Mirrors the Rust check_rules, with unknown edges taken into account: a clue is only short
// when the edges still open cannot make up its count, and a dot with one line is only a dead
// end once none of its other edges is open. A grid of the wrong length counts as empty.
function analyse(desc: LoopyDescription, grid: LoopyEdge[]): Analysis {
    const n = loopyEdgeCount(desc);
    const g = grid.length === n ? grid : emptyGrid(desc);
    const violations: LoopyViolation[] = [];
    const cellLines: number[] = [];

    desc.clues.forEach((expected, cell) => {
        let lines = 0;
        let unknown = 0;
        for (const e of loopyCellEdges(desc, cell)) {
            if (g[e] === LOOPY_LINE) lines++;
            else if (g[e] === 0) unknown++;
        }
        cellLines.push(lines);
        if (expected === undefined) return;
        const possible = lines + unknown;
        if (lines > expected || possible < expected) {
            violations.push({ kind: "clue_count", cell, expected, lines, possible });
        }
    });

    const dots = (desc.width + 1) * (desc.height + 1);
    let closed = true;
    for (let d = 0; d < dots; d++) {
        const edges = dotEdges(desc, d);
        const lines = edges.filter((e) => g[e] === LOOPY_LINE);
        const degree = lines.length;
        if (degree === 1 || degree >= 3) closed = false;
        if (degree >= 3 || (degree === 1 && edges.every((e) => g[e] !== 0))) {
            violations.push({ kind: "dot_degree", dot: d, degree, edges: lines });
        }
    }

    const loops: number[][] = [];
    if (closed) {
        const dsf = new Dsf(dots);
        for (let e = 0; e < n; e++) {
            if (g[e] !== LOOPY_LINE) continue;
            const [a, b] = edgeDots(desc, e);
            dsf.merge(a, b);
        }
        // Loops keyed by root, in order of first appearance.
        const roots: number[] = [];
        for (let e = 0; e < n; e++) {
            if (g[e] !== LOOPY_LINE) continue;
            const root = dsf.find(edgeDots(desc, e)[0]);
            let i = roots.indexOf(root);
            if (i < 0) {
                i = roots.length;
                roots.push(root);
                loops.push([]);
            }
            loops[i].push(e);
        }
        if (loops.length > 1) {
            // The largest loop is kept; ties go to the earliest.
            let largest = 0;
            loops.forEach((edges, i) => {
                if (edges.length > loops[largest].length) largest = i;
            });
            loops.forEach((edges, i) => {
                if (i !== largest) violations.push({ kind: "extra_loop", edges });
            });
        }
    }

    return { violations, cellLines, closed, loops };
}

export function checkRules(desc: LoopyDescription, grid: LoopyEdge[]): LoopyViolation[] {
    return analyse(desc, grid).violations;
}

/** Lines around each cell, for greying out satisfied clues. */
export function loopyCellLines(desc: LoopyDescription, grid: LoopyEdge[]): number[] {
    return analyse(desc, grid).cellLines;
}

export function isSolved(desc: LoopyDescription, grid: LoopyEdge[]): boolean {
    if (grid.length !== loopyEdgeCount(desc)) return false;
    const a = analyse(desc, grid);
    return (
        a.violations.length === 0 &&
        a.closed &&
        a.loops.length === 1 &&
        desc.clues.every((clue, cell) => clue === undefined || a.cellLines[cell] === clue)
    );
}

/** Lines are 1; crosses and unknowns are both 0. */
export function toGridBytes(grid: LoopyEdge[]): Uint8Array {
    return Uint8Array.from(grid, (e) => (e === LOOPY_LINE ? 1 : 0));
}

export function fromGridBytes(bytes: Uint8Array | number[]): LoopyEdge[] {
    return Array.from(bytes, (b) => (b !== 0 ? LOOPY_LINE : 0));
}

export function cycleEdge(edge: LoopyEdge): LoopyEdge {
    switch (edge) {
        case 0:
            return LOOPY_LINE;
        case LOOPY_LINE:
            return LOOPY_CROSS;
        case LOOPY_CROSS:
            return 0;
    }
}

// Violation kinds for the board: "clue_count" over a cell key whose clue is over or can no
// longer be met, "dot_degree" over the lines at a dot with three or more, or a dead end,
// "extra_loop" over the edges of every closed loop but the largest.
function toViolations(desc: LoopyDescription, violations: LoopyViolation[]): Violation[] {
    return violations.map((v) => {
        switch (v.kind) {
            case "clue_count":
                return { keys: [loopyCellKey(desc, v.cell)], kind: "clue_count" };
            case "dot_degree":
                return { keys: v.edges, kind: "dot_degree" };
            case "extra_loop":
                return { keys: v.edges, kind: "extra_loop" };
        }
    });
}

export const loopy: DailyGame<LoopyDescription, LoopyEdge[]> = {
    id: "loopy",
    parse: parseDescription,
    empty: emptyGrid,
    elements(desc): GameElement[] {
        const { width: w, height: h } = desc;
        const out: GameElement[] = [];
        for (let e = 0; e < horizontals(desc); e++) {
            out.push({ key: e, kind: "edge", x: e % w, y: Math.floor(e / w), w: 1, h: 0 });
        }
        for (let v = 0; v < h * (w + 1); v++) {
            const key = horizontals(desc) + v;
            out.push({ key, kind: "edge", x: v % (w + 1), y: Math.floor(v / (w + 1)), w: 0, h: 1 });
        }
        // Cells are not tap targets; they exist so hint focus on a clue can be painted.
        desc.clues.forEach((clue, cell) => {
            out.push({
                key: loopyCellKey(desc, cell),
                kind: "cell",
                x: cell % w,
                y: Math.floor(cell / w),
                w: 1,
                h: 1,
                label: clue === undefined ? undefined : String(clue),
            });
        });
        return out;
    },
    tap(desc, grid, key) {
        if (key < 0 || key >= loopyEdgeCount(desc)) return grid;
        const next = [...grid];
        next[key] = cycleEdge(next[key]);
        return next;
    },
    apply(desc, grid, key, value) {
        if (key < 0 || key >= loopyEdgeCount(desc)) return grid;
        const next = [...grid];
        next[key] = value === 1 ? LOOPY_LINE : LOOPY_CROSS;
        return next;
    },
    filled(_desc, grid) {
        const out: [number, number][] = [];
        grid.forEach((e, i) => {
            if (e === LOOPY_LINE) out.push([i, 1]);
            else if (e === LOOPY_CROSS) out.push([i, 0]);
        });
        return out;
    },
    check(desc, grid) {
        return toViolations(desc, checkRules(desc, grid));
    },
    solved: isSolved,
    toBytes(_desc, grid) {
        return toGridBytes(grid);
    },
    fromBytes(desc, bytes) {
        return bytes.length === loopyEdgeCount(desc) ? fromGridBytes(bytes) : undefined;
    },
    marks(_desc, grid) {
        const out = new Map<number, string>();
        grid.forEach((e, i) => {
            if (e === LOOPY_LINE) out.set(i, "line");
            else if (e === LOOPY_CROSS) out.set(i, "cross");
        });
        return out;
    },
};
