// Slant (Gokigen Naname) rule checker, a port of backend/libraries/slant `check_rules`.
//
// Wire format. Description: [version = 1, width, height, (width+1)*(height+1) vertex clue bytes
// row-major] where 0xFF = no clue, else 0..4. Grid: width*height cell bytes row-major,
// 1 = backslash (top-left to bottom-right), 2 = slash (bottom-left to top-right), 0 = undecided.
// Cell key = y*width+x. Vertex key = width*height + vertex index, so hint focus can name the
// clue it used; vertices are never conclusions.

import type { DailyGame, GameElement, Violation } from "./types";

/** 0 undecided, 1 backslash, 2 slash. */
export type SlantCell = 0 | 1 | 2;
export type SlantDescription = {
    width: number;
    height: number;
    /** (width+1)*(height+1) vertex clues row-major; undefined = no clue. */
    clues: (number | undefined)[];
};
export type SlantViolation =
    | { kind: "vertex_count"; vertex: number; expected: number; lines: number; possible: number }
    | { kind: "loop"; cells: number[] };

const FORMAT_VERSION = 1;
const NO_CLUE = 0xff;
export const SLANT_BACKSLASH = 1;
export const SLANT_SLASH = 2;

function malformed(): Error {
    return new Error("malformed slant description");
}

export function parseDescription(bytes: Uint8Array | number[]): SlantDescription {
    if (bytes.length < 3 || bytes[0] !== FORMAT_VERSION) {
        throw malformed();
    }
    const width = bytes[1];
    const height = bytes[2];
    if (width < 2 || height < 2 || bytes.length !== 3 + (width + 1) * (height + 1)) {
        throw malformed();
    }
    const clues: (number | undefined)[] = [];
    for (let i = 3; i < bytes.length; i++) {
        const b = bytes[i];
        if (b === NO_CLUE) {
            clues.push(undefined);
        } else if (b <= 4) {
            clues.push(b);
        } else {
            throw malformed();
        }
    }
    return { width, height, clues };
}

export function emptyGrid(desc: SlantDescription): SlantCell[] {
    return new Array<SlantCell>(desc.width * desc.height).fill(0);
}

export function vertexKey(desc: SlantDescription, vertex: number): number {
    return desc.width * desc.height + vertex;
}

/**
 * Cells around vertex (vx, vy) in Tatham's order (top-left, bottom-left, bottom-right,
 * top-right), each with the value that would connect that cell to the vertex.
 */
export function vertexNeighbours(
    desc: SlantDescription,
    vx: number,
    vy: number,
): [number, SlantCell][] {
    const { width: w, height: h } = desc;
    const out: [number, SlantCell][] = [];
    if (vx > 0 && vy > 0) out.push([(vy - 1) * w + (vx - 1), SLANT_BACKSLASH]);
    if (vx > 0 && vy < h) out.push([vy * w + (vx - 1), SLANT_SLASH]);
    if (vx < w && vy < h) out.push([vy * w + vx, SLANT_BACKSLASH]);
    if (vx < w && vy > 0) out.push([(vy - 1) * w + vx, SLANT_SLASH]);
    return out;
}

/** The two vertices joined by value `v` in cell `i`. */
function endpoints(desc: SlantDescription, i: number, v: SlantCell): [number, number] {
    const vw = desc.width + 1;
    const x = i % desc.width;
    const y = Math.floor(i / desc.width);
    return v === SLANT_BACKSLASH
        ? [y * vw + x, (y + 1) * vw + (x + 1)]
        : [y * vw + (x + 1), (y + 1) * vw + x];
}

/** Number of placed diagonals touching each vertex, in vertex order. */
export function slantVertexLines(desc: SlantDescription, grid: SlantCell[]): number[] {
    const out: number[] = [];
    for (let vy = 0; vy <= desc.height; vy++) {
        for (let vx = 0; vx <= desc.width; vx++) {
            out.push(vertexNeighbours(desc, vx, vy).filter(([j, s]) => grid[j] === s).length);
        }
    }
    return out;
}

// Union-find with the same root choice as the Rust dsf: the larger class wins, ties go to b.
class Dsf {
    private parent: number[];
    private size: number[];

    constructor(n: number) {
        this.parent = Array.from({ length: n }, (_, i) => i);
        this.size = new Array<number>(n).fill(1);
    }

    canonify(n: number): number {
        let root = n;
        while (this.parent[root] !== root) root = this.parent[root];
        let cur = n;
        while (this.parent[cur] !== root) {
            const next = this.parent[cur];
            this.parent[cur] = root;
            cur = next;
        }
        return root;
    }

    merge(a: number, b: number): void {
        const ra = this.canonify(a);
        const rb = this.canonify(b);
        if (ra === rb) return;
        const sa = this.size[ra];
        const sb = this.size[rb];
        const root = sa > sb ? ra : rb;
        const child = root === ra ? rb : ra;
        this.parent[child] = root;
        this.size[root] = sa + sb;
    }

    equivalent(a: number, b: number): boolean {
        return this.canonify(a) === this.canonify(b);
    }
}

/** Vertices reachable from `v` along placed diagonals in `grid`, each with the carrying cell. */
function adjacent(desc: SlantDescription, grid: SlantCell[], v: number): [number, number][] {
    const { width: w, height: h } = desc;
    const vw = w + 1;
    const vx = v % vw;
    const vy = Math.floor(v / vw);
    const cell = (cx: number, cy: number) => cy * w + cx;
    const out: [number, number][] = [];
    if (vx < w && vy < h && grid[cell(vx, vy)] === SLANT_BACKSLASH) {
        out.push([(vy + 1) * vw + vx + 1, cell(vx, vy)]);
    }
    if (vx > 0 && vy > 0 && grid[cell(vx - 1, vy - 1)] === SLANT_BACKSLASH) {
        out.push([(vy - 1) * vw + vx - 1, cell(vx - 1, vy - 1)]);
    }
    if (vx > 0 && vy < h && grid[cell(vx - 1, vy)] === SLANT_SLASH) {
        out.push([(vy + 1) * vw + vx - 1, cell(vx - 1, vy)]);
    }
    if (vx < w && vy > 0 && grid[cell(vx, vy - 1)] === SLANT_SLASH) {
        out.push([(vy - 1) * vw + vx + 1, cell(vx, vy - 1)]);
    }
    return out;
}

/** Cells along the path of placed diagonals from vertex a to b (unique in a forest); empty if none. */
function pathCells(desc: SlantDescription, forest: SlantCell[], a: number, b: number): number[] {
    const prev = new Array<[number, number] | undefined>((desc.width + 1) * (desc.height + 1));
    const queue: number[] = [a];
    prev[a] = [a, -1];
    for (let head = 0; head < queue.length; head++) {
        const v = queue[head];
        if (v === b) break;
        for (const [next, cell] of adjacent(desc, forest, v)) {
            if (prev[next] === undefined) {
                prev[next] = [v, cell];
                queue.push(next);
            }
        }
    }
    const out: number[] = [];
    let cur = b;
    while (cur !== a) {
        const p = prev[cur];
        if (p === undefined) return [];
        out.push(p[1]);
        cur = p[0];
    }
    out.reverse();
    return out;
}

export function checkRules(desc: SlantDescription, grid: SlantCell[]): SlantViolation[] {
    const { width: w, height: h } = desc;
    const n = w * h;
    const g: SlantCell[] = grid.length === n ? grid : emptyGrid(desc);
    const out: SlantViolation[] = [];

    const vw = w + 1;
    for (let vy = 0; vy <= h; vy++) {
        for (let vx = 0; vx < vw; vx++) {
            const vertex = vy * vw + vx;
            const expected = desc.clues[vertex];
            if (expected === undefined) continue;
            let lines = 0;
            let undecided = 0;
            for (const [j, s] of vertexNeighbours(desc, vx, vy)) {
                if (g[j] === 0) undecided++;
                else if (g[j] === s) lines++;
            }
            const possible = lines + undecided;
            if (lines > expected || possible < expected) {
                out.push({ kind: "vertex_count", vertex, expected, lines, possible });
            }
        }
    }

    // Build a spanning forest cell by cell; every diagonal that would join two already-connected
    // vertices closes a loop, reported with the forest path it closes.
    const forest = emptyGrid(desc);
    const dsf = new Dsf(vw * (h + 1));
    for (let i = 0; i < n; i++) {
        const v = g[i];
        if (v === 0) continue;
        const [a, b] = endpoints(desc, i, v);
        if (dsf.equivalent(a, b)) {
            out.push({ kind: "loop", cells: [...pathCells(desc, forest, a, b), i] });
        } else {
            dsf.merge(a, b);
            forest[i] = v;
        }
    }
    return out;
}

export function isSolved(desc: SlantDescription, grid: SlantCell[]): boolean {
    return (
        grid.length === desc.width * desc.height &&
        grid.every((c) => c !== 0) &&
        checkRules(desc, grid).length === 0
    );
}

export function toGridBytes(grid: SlantCell[]): Uint8Array {
    return Uint8Array.from(grid);
}

export function fromGridBytes(bytes: Uint8Array | number[]): SlantCell[] {
    return Array.from(bytes, (b) => (b === SLANT_BACKSLASH || b === SLANT_SLASH ? b : 0));
}

export function cycleCell(cell: SlantCell): SlantCell {
    switch (cell) {
        case 0:
            return SLANT_BACKSLASH;
        case SLANT_BACKSLASH:
            return SLANT_SLASH;
        case SLANT_SLASH:
            return 0;
    }
}

// Violation kinds for the board: "vertex_count" over a vertex key whose clue can no longer be
// met, "loop" over the cells whose diagonals close a loop.
function toViolations(desc: SlantDescription, violations: SlantViolation[]): Violation[] {
    return violations.map((v) =>
        v.kind === "vertex_count"
            ? { keys: [vertexKey(desc, v.vertex)], kind: "vertex_count" }
            : { keys: v.cells, kind: "loop" },
    );
}

export const slant: DailyGame<SlantDescription, SlantCell[]> = {
    id: "slant",
    parse: parseDescription,
    empty: emptyGrid,
    elements(desc): GameElement[] {
        const { width: w, height: h } = desc;
        const out: GameElement[] = [];
        for (let i = 0; i < w * h; i++) {
            out.push({ key: i, kind: "cell", x: i % w, y: Math.floor(i / w), w: 1, h: 1 });
        }
        // Vertices are not tap targets; they exist so hint focus on a clue can be painted.
        desc.clues.forEach((clue, v) => {
            out.push({
                key: vertexKey(desc, v),
                kind: "vertex",
                x: v % (w + 1),
                y: Math.floor(v / (w + 1)),
                w: 0,
                h: 0,
                label: clue === undefined ? undefined : String(clue),
            });
        });
        return out;
    },
    tap(desc, grid, key) {
        if (key < 0 || key >= desc.width * desc.height) return grid;
        const next = [...grid];
        next[key] = cycleCell(next[key]);
        return next;
    },
    apply(desc, grid, key, value) {
        if (key < 0 || key >= desc.width * desc.height) return grid;
        if (value !== SLANT_BACKSLASH && value !== SLANT_SLASH) return grid;
        const next = [...grid];
        next[key] = value;
        return next;
    },
    filled(_desc, grid) {
        const out: [number, number][] = [];
        grid.forEach((c, i) => {
            if (c !== 0) out.push([i, c]);
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
        return bytes.length === desc.width * desc.height ? fromGridBytes(bytes) : undefined;
    },
    marks(_desc, grid) {
        const out = new Map<number, string>();
        grid.forEach((c, i) => {
            if (c === SLANT_BACKSLASH) out.set(i, "backslash");
            else if (c === SLANT_SLASH) out.set(i, "slash");
        });
        return out;
    },
};
