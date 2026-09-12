// Tents rule checker, a port of backend/libraries/tents `check_rules`.
//
// Wire format. Description: [version = 1, width, height, width*height cell bytes row-major
// (0 = empty, 1 = tree), height row counts, width column counts].
// Grid: width*height bytes row-major, 1 = tent, 0 = no tent (trees are 0). Cell key = y*width+x.
// Conclusion values: 1 = tent, 0 = grass.

import type { DailyGame, GameElement, Violation } from "./types";

export const TENTS_GAME_ID = "tents";

export type TentsCell = "" | "tent" | "grass";
export type TentsDescription = {
    width: number;
    height: number;
    /** true = tree */
    trees: boolean[];
    rowCounts: number[];
    columnCounts: number[];
};
export type TentsViolation =
    | { kind: "tent_on_tree"; cell: number }
    | { kind: "tents_touch"; a: number; b: number }
    | { kind: "tent_without_tree"; cell: number }
    | { kind: "row_count"; row: number; expected: number; actual: number }
    | { kind: "column_count"; column: number; expected: number; actual: number }
    | { kind: "unmatched"; trees: number[]; tents: number[] };

const FORMAT_VERSION = 1;
const CELL_EMPTY = 0;
const CELL_TREE = 1;

function malformed(): Error {
    return new Error("malformed tents description");
}

export function parseDescription(bytes: Uint8Array | number[]): TentsDescription {
    if (bytes.length < 3 || bytes[0] !== FORMAT_VERSION) {
        throw malformed();
    }
    const width = bytes[1];
    const height = bytes[2];
    if (width === 0 || height === 0) {
        throw malformed();
    }
    const n = width * height;
    if (bytes.length !== 3 + n + height + width) {
        throw malformed();
    }
    const trees: boolean[] = [];
    for (let i = 3; i < 3 + n; i++) {
        const b = bytes[i];
        if (b === CELL_EMPTY) {
            trees.push(false);
        } else if (b === CELL_TREE) {
            trees.push(true);
        } else {
            throw malformed();
        }
    }
    const rowCounts = Array.from(bytes.slice(3 + n, 3 + n + height));
    const columnCounts = Array.from(bytes.slice(3 + n + height));
    if (rowCounts.some((c) => c > width) || columnCounts.some((c) => c > height)) {
        throw malformed();
    }
    return { width, height, trees, rowCounts, columnCounts };
}

export function emptyGrid(desc: TentsDescription): TentsCell[] {
    return desc.trees.map(() => "");
}

function offset(desc: TentsDescription, i: number, dx: number, dy: number): number | undefined {
    const x = (i % desc.width) + dx;
    const y = Math.floor(i / desc.width) + dy;
    return x >= 0 && x < desc.width && y >= 0 && y < desc.height ? y * desc.width + x : undefined;
}

/** Orthogonal neighbours in left, right, up, down order. */
export function neighbours(desc: TentsDescription, i: number): number[] {
    const out: number[] = [];
    for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
    ]) {
        const j = offset(desc, i, dx, dy);
        if (j !== undefined) out.push(j);
    }
    return out;
}

// Right, and the three cells below, so each touching pair is reported once.
const TOUCH_DIRS: [number, number][] = [
    [1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
];

export function checkRules(desc: TentsDescription, grid: TentsCell[]): TentsViolation[] {
    const { width: w, height: h, trees } = desc;
    const n = w * h;
    const tent = (i: number) => grid.length === n && grid[i] === "tent";
    const tree = (i: number) => trees[i];
    const out: TentsViolation[] = [];

    for (let i = 0; i < n; i++) {
        if (!tent(i)) continue;
        if (tree(i)) {
            out.push({ kind: "tent_on_tree", cell: i });
            continue;
        }
        for (const [dx, dy] of TOUCH_DIRS) {
            const j = offset(desc, i, dx, dy);
            if (j !== undefined && tent(j) && !tree(j)) {
                out.push({ kind: "tents_touch", a: i, b: j });
            }
        }
        if (!neighbours(desc, i).some(tree)) {
            out.push({ kind: "tent_without_tree", cell: i });
        }
    }

    for (let y = 0; y < h; y++) {
        let actual = 0;
        for (let x = 0; x < w; x++) if (tent(y * w + x)) actual++;
        if (actual !== desc.rowCounts[y]) {
            out.push({ kind: "row_count", row: y, expected: desc.rowCounts[y], actual });
        }
    }
    for (let x = 0; x < w; x++) {
        let actual = 0;
        for (let y = 0; y < h; y++) if (tent(y * w + x)) actual++;
        if (actual !== desc.columnCounts[x]) {
            out.push({ kind: "column_count", column: x, expected: desc.columnCounts[x], actual });
        }
    }

    // Components of the bipartite tree/tent adjacency graph. A component whose tree and tent
    // counts differ cannot be matched one-to-one; with the touching rule this is complete.
    const parent = Array.from({ length: n }, (_, i) => i);
    const find = (i: number): number => {
        while (parent[i] !== i) {
            parent[i] = parent[parent[i]];
            i = parent[i];
        }
        return i;
    };
    for (let i = 0; i < n; i++) {
        const x = i % w;
        const y = Math.floor(i / w);
        const candidates: number[] = [];
        if (x + 1 < w) candidates.push(i + 1);
        if (y + 1 < h) candidates.push(i + w);
        for (const j of candidates) {
            const joined = (tree(i) && tent(j) && !tree(j)) || (tent(i) && !tree(i) && tree(j));
            if (joined) {
                parent[find(i)] = find(j);
            }
        }
    }
    const members: { trees: number[]; tents: number[] }[] = Array.from({ length: n }, () => ({
        trees: [],
        tents: [],
    }));
    for (let i = 0; i < n; i++) {
        if (tree(i)) {
            members[find(i)].trees.push(i);
        } else if (tent(i)) {
            members[find(i)].tents.push(i);
        }
    }
    for (const m of members) {
        // Only more tents than trees is a mistake: fewer tents is a grid still in progress
        // (every tree starts as a group of one tree and no tents). With exact row and column
        // counts the totals agree, so tents <= trees in every group means equality in every
        // group and `solved` still needs a full one-to-one matching. A lone tent is already
        // reported as tent_without_tree.
        if (m.tents.length > m.trees.length && m.trees.length > 0) {
            out.push({ kind: "unmatched", trees: m.trees, tents: m.tents });
        }
    }
    return out;
}

export function isSolved(desc: TentsDescription, grid: TentsCell[]): boolean {
    return checkRules(desc, grid).length === 0;
}

export function toGridBytes(grid: TentsCell[]): Uint8Array {
    return Uint8Array.from(grid, (c) => (c === "tent" ? 1 : 0));
}

export function fromGridBytes(bytes: Uint8Array | number[]): TentsCell[] {
    return Array.from(bytes, (b) => (b !== 0 ? "tent" : ""));
}

export function cycleCell(cell: TentsCell): TentsCell {
    switch (cell) {
        case "":
            return "tent";
        case "tent":
            return "grass";
        case "grass":
            return "";
    }
}

/** Every non-tree cell in row `y` carries a mark. */
function rowMarked(desc: TentsDescription, grid: TentsCell[], y: number): boolean {
    for (let x = 0; x < desc.width; x++) {
        const i = y * desc.width + x;
        if (!desc.trees[i] && grid[i] === "") return false;
    }
    return true;
}

function columnMarked(desc: TentsDescription, grid: TentsCell[], x: number): boolean {
    for (let y = 0; y < desc.height; y++) {
        const i = y * desc.width + x;
        if (!desc.trees[i] && grid[i] === "") return false;
    }
    return true;
}

// Violation kinds for the board. Cell keys: "clash" = a tent that touches another or sits on a
// tree, "lonely" = a tent with no tree beside it, "unmatched" = trees and tents in a group that
// cannot pair up. Line keys sit past the cell keys (rows first, then columns, see
// `tentsRowKey` / `tentsColumnKey`): "over" = too many tents, "under" = too few in a line
// whose every non-tree cell is marked. An under-count in a part-marked line is not a mistake
// yet, so it is not reported; `solved` still requires exact counts.
export function tentsRowKey(desc: TentsDescription, y: number): number {
    return desc.width * desc.height + y;
}

export function tentsColumnKey(desc: TentsDescription, x: number): number {
    return desc.width * desc.height + desc.height + x;
}

function toViolations(
    desc: TentsDescription,
    grid: TentsCell[],
    violations: TentsViolation[],
): Violation[] {
    const out: Violation[] = [];
    for (const v of violations) {
        switch (v.kind) {
            case "tent_on_tree":
                out.push({ keys: [v.cell], kind: "clash" });
                break;
            case "tents_touch":
                out.push({ keys: [v.a, v.b], kind: "clash" });
                break;
            case "tent_without_tree":
                out.push({ keys: [v.cell], kind: "lonely" });
                break;
            case "row_count":
                if (v.actual > v.expected) {
                    out.push({ keys: [tentsRowKey(desc, v.row)], kind: "over" });
                } else if (rowMarked(desc, grid, v.row)) {
                    out.push({ keys: [tentsRowKey(desc, v.row)], kind: "under" });
                }
                break;
            case "column_count":
                if (v.actual > v.expected) {
                    out.push({ keys: [tentsColumnKey(desc, v.column)], kind: "over" });
                } else if (columnMarked(desc, grid, v.column)) {
                    out.push({ keys: [tentsColumnKey(desc, v.column)], kind: "under" });
                }
                break;
            case "unmatched":
                out.push({ keys: [...v.trees, ...v.tents], kind: "unmatched" });
                break;
        }
    }
    return out;
}

export const tents: DailyGame<TentsDescription, TentsCell[]> = {
    id: TENTS_GAME_ID,
    parse: parseDescription,
    empty: emptyGrid,
    elements(desc): GameElement[] {
        return desc.trees.map((_, i) => ({
            key: i,
            kind: "cell",
            x: i % desc.width,
            y: Math.floor(i / desc.width),
            w: 1,
            h: 1,
        }));
    },
    tap(desc, grid, key) {
        if (desc.trees[key] !== false) return grid;
        const next = [...grid];
        next[key] = cycleCell(next[key]);
        return next;
    },
    apply(desc, grid, key, value) {
        if (desc.trees[key] !== false) return grid;
        const next = [...grid];
        next[key] = value === 1 ? "tent" : "grass";
        return next;
    },
    filled(_desc, grid) {
        const out: [number, number][] = [];
        grid.forEach((c, i) => {
            if (c === "tent") out.push([i, 1]);
            else if (c === "grass") out.push([i, 0]);
        });
        return out;
    },
    check(desc, grid) {
        return toViolations(desc, grid, checkRules(desc, grid));
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
            if (c !== "") out.set(i, c);
        });
        return out;
    },
};
