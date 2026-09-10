// Bridges (Hashiwokakero) rule checker, a port of backend/libraries/bridges `check_rules`.
//
// Wire format. Description: [version = 1, width, height, width*height cell bytes row-major]
// where 0 = water, 1..8 = island with that bridge count. Grid: width*height bytes row-major,
// 0 = nothing (always 0 on islands), 1/2 = one/two horizontal bridges through the cell,
// 3/4 = one/two vertical.
//
// Keys. An edge is a pair of islands with only water between them, keyed by
// `from_cell * 2 + dir` where from_cell is the left / top island's cell index and dir 0 = right,
// 1 = down. Values are bridge counts 0, 1 or 2. Islands are elements keyed by their cell index
// (never tappable); hint focus and mistake keys are plain cell indices. The two key spaces
// overlap, so a Board must read keys by element kind / violation kind, never by value alone.
//
// State. Only edges the user has touched are in the map: tapping cycles 0 -> 1 -> 2 -> 0, and a
// 0 the user cycled back to stays as an explicit entry, a committed "no bridge". `filled()`
// sends those zeros too, so the server skips conclusions the user already ruled out, and an
// island is only reported short once every one of its edges is committed.

import type { DailyGame, GameElement, Violation } from "./types";

export type BridgesEdge = {
    key: number;
    /** Cell index of the left / top island. */
    a: number;
    /** Cell index of the right / bottom island. */
    b: number;
    horizontal: boolean;
    /** The water cells between the islands, nearest `a` first. */
    cells: number[];
    /** Keys of edges of the other orientation sharing a cell with this one. */
    crossings: number[];
};
export type BridgesDescription = {
    width: number;
    height: number;
    /** 0 = water, 1..8 = island with that bridge count. */
    cells: number[];
    /** Every place bridges can go, in the order the backend derives them. */
    edges: BridgesEdge[];
};
/** Edge key -> bridge count (0, 1 or 2) for every edge the user has committed. */
export type BridgesState = Map<number, number>;
export type BridgesViolation =
    | { kind: "crossing"; horizontal: number; vertical: number }
    | { kind: "island_count"; cell: number; expected: number; actual: number }
    /** Every island is satisfied but these islands are cut off from the island with the lowest cell index. */
    | { kind: "disconnected"; islands: number[] };

const FORMAT_VERSION = 1;
const MAX_ISLAND = 8;
const MAX_BRIDGES = 2;

function malformed(): Error {
    return new Error("malformed bridges description");
}

function deriveEdges(width: number, height: number, cells: number[]): BridgesEdge[] {
    const n = width * height;
    const edges: BridgesEdge[] = [];
    const hAt = new Array<BridgesEdge | undefined>(n);
    const vAt = new Array<BridgesEdge | undefined>(n);
    for (let cell = 0; cell < n; cell++) {
        if (cells[cell] === 0) continue;
        const x = cell % width;
        const y = Math.floor(cell / width);
        let water: number[] = [];
        for (let cx = x + 1; cx < width; cx++) {
            const c = y * width + cx;
            if (cells[c] !== 0) {
                const edge = {
                    key: cell * 2,
                    a: cell,
                    b: c,
                    horizontal: true,
                    cells: water,
                    crossings: [],
                };
                water.forEach((w) => (hAt[w] = edge));
                edges.push(edge);
                break;
            }
            water.push(c);
        }
        water = [];
        for (let cy = y + 1; cy < height; cy++) {
            const c = cy * width + x;
            if (cells[c] !== 0) {
                const edge = {
                    key: cell * 2 + 1,
                    a: cell,
                    b: c,
                    horizontal: false,
                    cells: water,
                    crossings: [],
                };
                water.forEach((w) => (vAt[w] = edge));
                edges.push(edge);
                break;
            }
            water.push(c);
        }
    }
    for (let c = 0; c < n; c++) {
        const h = hAt[c];
        const v = vAt[c];
        if (h !== undefined && v !== undefined) {
            h.crossings.push(v.key);
            v.crossings.push(h.key);
        }
    }
    return edges;
}

export function parseDescription(bytes: Uint8Array | number[]): BridgesDescription {
    if (bytes.length < 3 || bytes[0] !== FORMAT_VERSION) {
        throw malformed();
    }
    const width = bytes[1];
    const height = bytes[2];
    if (bytes.length !== 3 + width * height) {
        throw malformed();
    }
    const cells = Array.from(bytes.slice(3));
    let islands = 0;
    cells.forEach((b, i) => {
        if (b > MAX_ISLAND) throw malformed();
        if (b === 0) return;
        islands++;
        const x = i % width;
        // islands never touch orthogonally
        if ((x > 0 && cells[i - 1] !== 0) || (i >= width && cells[i - width] !== 0)) {
            throw malformed();
        }
    });
    if (islands < 2) {
        throw malformed();
    }
    return { width, height, cells, edges: deriveEdges(width, height, cells) };
}

export function emptyState(): BridgesState {
    return new Map();
}

export function edgeByKey(desc: BridgesDescription, key: number): BridgesEdge | undefined {
    return desc.edges.find((e) => e.key === key);
}

/** The edges touching the island at `cell`. */
export function islandEdges(desc: BridgesDescription, cell: number): BridgesEdge[] {
    return desc.edges.filter((e) => e.a === cell || e.b === cell);
}

/** Cell indices of the islands, in cell order. */
export function islandCells(desc: BridgesDescription): number[] {
    const out: number[] = [];
    desc.cells.forEach((b, i) => {
        if (b !== 0) out.push(i);
    });
    return out;
}

function count(state: BridgesState, key: number): number {
    return state.get(key) ?? 0;
}

/** Island cell -> bridges placed on it so far. */
export function bridgesIslandTotals(
    desc: BridgesDescription,
    state: BridgesState,
): Map<number, number> {
    const out = new Map<number, number>();
    for (const cell of islandCells(desc)) out.set(cell, 0);
    for (const e of desc.edges) {
        const c = count(state, e.key);
        if (c === 0) continue;
        out.set(e.a, (out.get(e.a) ?? 0) + c);
        out.set(e.b, (out.get(e.b) ?? 0) + c);
    }
    return out;
}

/** Groups of islands not reachable from the first island along placed bridges, in first-index order. */
function cutOff(desc: BridgesDescription, state: BridgesState): number[][] {
    const islands = islandCells(desc);
    if (islands.length === 0) return [];
    const component = new Map<number, number>();
    const adjacent = new Map<number, number[]>();
    for (const e of desc.edges) {
        if (count(state, e.key) === 0) continue;
        adjacent.set(e.a, [...(adjacent.get(e.a) ?? []), e.b]);
        adjacent.set(e.b, [...(adjacent.get(e.b) ?? []), e.a]);
    }
    let next = 0;
    for (const start of islands) {
        if (component.has(start)) continue;
        const id = next++;
        const queue = [start];
        component.set(start, id);
        for (let head = 0; head < queue.length; head++) {
            for (const other of adjacent.get(queue[head]) ?? []) {
                if (!component.has(other)) {
                    component.set(other, id);
                    queue.push(other);
                }
            }
        }
    }
    const groups: number[][] = [];
    for (const cell of islands.slice(1)) {
        const id = component.get(cell)!;
        if (id === 0) continue;
        groups[id] = [...(groups[id] ?? []), cell];
    }
    return groups.filter((g) => g !== undefined);
}

export function checkRules(desc: BridgesDescription, state: BridgesState): BridgesViolation[] {
    const out: BridgesViolation[] = [];

    for (const e of desc.edges) {
        if (!e.horizontal || count(state, e.key) === 0) continue;
        for (const c of e.crossings) {
            if (count(state, c) > 0) {
                out.push({ kind: "crossing", horizontal: e.key, vertical: c });
            }
        }
    }

    let allFull = true;
    const totals = bridgesIslandTotals(desc, state);
    for (const cell of islandCells(desc)) {
        const expected = desc.cells[cell];
        const actual = totals.get(cell) ?? 0;
        if (actual !== expected) {
            allFull = false;
            out.push({ kind: "island_count", cell, expected, actual });
        }
    }

    if (allFull) {
        for (const islands of cutOff(desc, state)) {
            out.push({ kind: "disconnected", islands });
        }
    }
    return out;
}

/** Every island exactly met, no crossings, all connected. */
export function isSolved(desc: BridgesDescription, state: BridgesState): boolean {
    return checkRules(desc, state).length === 0;
}

/** Solution bytes: 0 nothing, 1/2 horizontal, 3/4 vertical. */
export function toGridBytes(desc: BridgesDescription, state: BridgesState): Uint8Array {
    const out = new Uint8Array(desc.width * desc.height);
    for (const e of desc.edges) {
        const c = count(state, e.key);
        if (c === 0) continue;
        const byte = e.horizontal ? c : 2 + c;
        for (const cell of e.cells) out[cell] = byte;
    }
    return out;
}

/**
 * Edge counts from grid bytes; undefined for the wrong length or a layout the backend would
 * reject (a byte above 4, a bridge on an island or on water that is not between two islands in
 * that orientation, or an edge whose cells disagree). Only edges with bridges become entries;
 * bytes cannot say which empty edges the user committed to.
 */
export function fromGridBytes(
    desc: BridgesDescription,
    bytes: Uint8Array | number[],
): BridgesState | undefined {
    const n = desc.width * desc.height;
    if (bytes.length !== n) return undefined;
    const onH = new Array<boolean>(n).fill(false);
    const onV = new Array<boolean>(n).fill(false);
    for (const e of desc.edges) {
        for (const c of e.cells) (e.horizontal ? onH : onV)[c] = true;
    }
    for (let i = 0; i < n; i++) {
        const b = bytes[i];
        if (b > 4 || (b !== 0 && desc.cells[i] !== 0)) return undefined;
        if ((b === 1 || b === 2) && !onH[i]) return undefined;
        if ((b === 3 || b === 4) && !onV[i]) return undefined;
    }
    const state: BridgesState = new Map();
    for (const e of desc.edges) {
        let val: number | undefined;
        let zero = false;
        let mixed = false;
        for (const c of e.cells) {
            const b = bytes[c];
            if (b === 0) {
                zero = true;
                continue;
            }
            const own = e.horizontal ? (b <= 2 ? b : undefined) : b >= 3 ? b - 2 : undefined;
            if (own === undefined) continue;
            if (val === undefined) val = own;
            else if (val !== own) mixed = true;
        }
        if (val === undefined) continue;
        if (zero || mixed) return undefined;
        state.set(e.key, val);
    }
    return state;
}

// Violation kinds for the board: "crossing" over the two edge keys, "over" / "under" over an
// island cell (under only once every edge of that island is committed), "disconnected" over the
// island cells cut off from the first island.
function toViolations(
    desc: BridgesDescription,
    state: BridgesState,
    violations: BridgesViolation[],
): Violation[] {
    const out: Violation[] = [];
    for (const v of violations) {
        switch (v.kind) {
            case "crossing":
                out.push({ keys: [v.horizontal, v.vertical], kind: "crossing" });
                break;
            case "island_count":
                if (v.actual > v.expected) {
                    out.push({ keys: [v.cell], kind: "over" });
                } else if (islandEdges(desc, v.cell).every((e) => state.has(e.key))) {
                    out.push({ keys: [v.cell], kind: "under" });
                }
                break;
            case "disconnected":
                out.push({ keys: v.islands, kind: "disconnected" });
                break;
        }
    }
    return out;
}

export const bridges: DailyGame<BridgesDescription, BridgesState> = {
    id: "bridges",
    parse: parseDescription,
    empty: emptyState,
    // Islands are cells with their number as label. Edges are rects covering the water between
    // the two islands (not thin boundary rects), so a tap anywhere along the gap hits the edge;
    // a Board draws them as plain cell-unit rects rather than through elementRect.
    elements(desc): GameElement[] {
        const out: GameElement[] = [];
        for (const cell of islandCells(desc)) {
            out.push({
                key: cell,
                kind: "cell",
                x: cell % desc.width,
                y: Math.floor(cell / desc.width),
                w: 1,
                h: 1,
                label: String(desc.cells[cell]),
            });
        }
        for (const e of desc.edges) {
            const ax = e.a % desc.width;
            const ay = Math.floor(e.a / desc.width);
            out.push(
                e.horizontal
                    ? { key: e.key, kind: "edge", x: ax + 1, y: ay, w: e.cells.length, h: 1 }
                    : { key: e.key, kind: "edge", x: ax, y: ay + 1, w: 1, h: e.cells.length },
            );
        }
        return out;
    },
    tap(desc, state, key) {
        if (edgeByKey(desc, key) === undefined) return state;
        const next = new Map(state);
        next.set(key, (count(state, key) + 1) % (MAX_BRIDGES + 1));
        return next;
    },
    apply(desc, state, key, value) {
        if (edgeByKey(desc, key) === undefined) return state;
        if (value < 0 || value > MAX_BRIDGES) return state;
        const next = new Map(state);
        next.set(key, value);
        return next;
    },
    filled(_desc, state) {
        return [...state.entries()];
    },
    check(desc, state) {
        return toViolations(desc, state, checkRules(desc, state));
    },
    solved: isSolved,
    toBytes: toGridBytes,
    fromBytes: fromGridBytes,
    marks(_desc, state) {
        const out = new Map<number, string>();
        for (const [key, c] of state) {
            out.set(key, c === 0 ? "none" : c === 1 ? "one" : "two");
        }
        return out;
    },
};
