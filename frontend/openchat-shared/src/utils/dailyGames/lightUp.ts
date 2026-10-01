// Light Up (Akari) rule checker, a port of backend/libraries/light_up `check_rules`.
//
// Wire format. Description: [version = 1, width, height, width*height cell bytes row-major]
// where 0x00 = white, 0x10 = black unnumbered, 0x11..0x15 = black with clue 0..4.
// Grid: width*height bytes row-major, 1 = bulb, 0 = no bulb. Cell key = y*width+x.

import { LIGHT_UP_GAME_ID } from "../../domain/dailyPuzzle";
import type {
    DailyGame,
    GameElement,
    HintCaption,
    HintKeyStatus,
    HintStep,
    Violation,
} from "./types";

export type LightUpCell = "empty" | "bulb" | "dot";
export type LightUpDescCell = { kind: "white" } | { kind: "black"; clue?: number };
export type LightUpDescription = { width: number; height: number; cells: LightUpDescCell[] };
export type LightUpViolation =
    | { kind: "bulb_sees_bulb"; a: number; b: number }
    | { kind: "clue_count"; clue: number; expected: number; actual: number }
    | { kind: "unlit"; cell: number }
    | { kind: "bulb_on_black"; cell: number };

const FORMAT_VERSION = 1;
const CELL_WHITE = 0x00;
const CELL_BLACK = 0x10;
const CELL_CLUE_BASE = 0x11;
const CELL_CLUE_MAX = 0x15;

function malformed(): Error {
    return new Error("malformed light up description");
}

export function parseDescription(bytes: Uint8Array | number[]): LightUpDescription {
    if (bytes.length < 3 || bytes[0] !== FORMAT_VERSION) {
        throw malformed();
    }
    const width = bytes[1];
    const height = bytes[2];
    if (bytes.length !== 3 + width * height) {
        throw malformed();
    }
    const cells: LightUpDescCell[] = [];
    for (let i = 3; i < bytes.length; i++) {
        const b = bytes[i];
        if (b === CELL_WHITE) {
            cells.push({ kind: "white" });
        } else if (b === CELL_BLACK) {
            cells.push({ kind: "black" });
        } else if (b >= CELL_CLUE_BASE && b <= CELL_CLUE_MAX) {
            cells.push({ kind: "black", clue: b - CELL_CLUE_BASE });
        } else {
            throw malformed();
        }
    }
    return { width, height, cells };
}

export function emptyGrid(desc: LightUpDescription): LightUpCell[] {
    return desc.cells.map(() => "empty");
}

export function neighbours(desc: LightUpDescription, index: number): number[] {
    const w = desc.width;
    const n = w * desc.height;
    const x = index % w;
    const out: number[] = [];
    if (x > 0) out.push(index - 1);
    if (x + 1 < w) out.push(index + 1);
    if (index >= w) out.push(index - w);
    if (index + w < n) out.push(index + w);
    return out;
}

const SCAN_DIRS: [number, number][] = [
    [1, 0],
    [0, 1],
];

function scanBulbs(
    desc: LightUpDescription,
    grid: LightUpCell[],
): { lit: boolean[]; violations: LightUpViolation[] } {
    const { width: w, height: h, cells } = desc;
    const n = w * h;
    const bulb = (i: number) => grid.length === n && grid[i] === "bulb";
    const black = (i: number) => cells[i].kind === "black";
    const violations: LightUpViolation[] = [];
    const lit = new Array<boolean>(n).fill(false);

    for (let i = 0; i < n; i++) {
        if (!bulb(i)) continue;
        if (black(i)) {
            violations.push({ kind: "bulb_on_black", cell: i });
            continue;
        }
        lit[i] = true;
        const x = i % w;
        const y = Math.floor(i / w);
        for (const [dx, dy] of SCAN_DIRS) {
            let cx = x + dx;
            let cy = y + dy;
            while (cx < w && cy < h && !black(cy * w + cx)) {
                const j = cy * w + cx;
                lit[j] = true;
                if (bulb(j)) {
                    violations.push({ kind: "bulb_sees_bulb", a: i, b: j });
                }
                cx += dx;
                cy += dy;
            }
        }
        for (const [dx, dy] of SCAN_DIRS) {
            let cx = x;
            let cy = y;
            while (cx >= dx && cy >= dy) {
                cx -= dx;
                cy -= dy;
                const j = cy * w + cx;
                if (black(j)) break;
                lit[j] = true;
            }
        }
    }
    return { lit, violations };
}

export function computeLighting(desc: LightUpDescription, grid: LightUpCell[]): boolean[] {
    return scanBulbs(desc, grid).lit;
}

export function checkRules(desc: LightUpDescription, grid: LightUpCell[]): LightUpViolation[] {
    const { lit, violations } = scanBulbs(desc, grid);
    const n = desc.width * desc.height;
    const bulb = (i: number) => grid.length === n && grid[i] === "bulb";

    desc.cells.forEach((cell, i) => {
        if (cell.kind === "white") {
            if (!lit[i]) {
                violations.push({ kind: "unlit", cell: i });
            }
        } else if (cell.clue !== undefined) {
            const expected = cell.clue;
            const actual = neighbours(desc, i).filter(bulb).length;
            if (actual !== expected) {
                violations.push({ kind: "clue_count", clue: i, expected, actual });
            }
        }
    });
    return violations;
}

export function isSolved(desc: LightUpDescription, grid: LightUpCell[]): boolean {
    return checkRules(desc, grid).length === 0;
}

export function toGridBytes(grid: LightUpCell[]): Uint8Array {
    return Uint8Array.from(grid, (c) => (c === "bulb" ? 1 : 0));
}

export function fromGridBytes(bytes: Uint8Array | number[]): LightUpCell[] {
    return Array.from(bytes, (b) => (b !== 0 ? "bulb" : "empty"));
}

export function cycleCell(cell: LightUpCell): LightUpCell {
    switch (cell) {
        case "empty":
            return "bulb";
        case "bulb":
            return "dot";
        case "dot":
            return "empty";
    }
}

// Whether any cell that could light `index` can still take a bulb: itself, or an empty cell in
// its line of sight before the first black cell in each direction.
function canStillBeLit(desc: LightUpDescription, grid: LightUpCell[], index: number): boolean {
    if (grid[index] === "empty") return true;
    const w = desc.width;
    const h = desc.height;
    const x = index % w;
    const y = Math.floor(index / w);
    for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
    ]) {
        for (
            let cx = x + dx, cy = y + dy;
            cx >= 0 && cx < w && cy >= 0 && cy < h;
            cx += dx, cy += dy
        ) {
            const j = cy * w + cx;
            if (desc.cells[j].kind !== "white") break;
            if (grid[j] === "empty") return true;
        }
    }
    return false;
}

/** The white cells a bulb at `index` would shine on, up to the nearest black cell or edge. */
function sight(desc: LightUpDescription, index: number): number[] {
    const w = desc.width;
    const h = desc.height;
    const x = index % w;
    const y = Math.floor(index / w);
    const out: number[] = [];
    for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
    ]) {
        for (
            let cx = x + dx, cy = y + dy;
            cx >= 0 && cx < w && cy >= 0 && cy < h;
            cx += dx, cy += dy
        ) {
            const j = cy * w + cx;
            if (desc.cells[j].kind !== "white") break;
            out.push(j);
        }
    }
    return out;
}

/**
 * The sentence for a served step, naming the number or cell it is about by its row and column.
 * Every step reasons about one unit, listed whole in its focus (invariant 23): a dark cell with
 * every cell that could shine on it, or a number with the white cells beside it. Undefined for a
 * step that cannot be read that way, which then gets the technique's fixed sentence.
 */
export function hintCaption(
    desc: LightUpDescription,
    grid: LightUpCell[],
    step: HintStep,
): HintCaption | undefined {
    const w = desc.width;
    const focus = new Set(step.focus);
    const target = step.target;
    const at = (k: number) => ({ row: Math.floor(k / w) + 1, column: (k % w) + 1 });
    const clueAt = (k: number) => {
        const cell = desc.cells[k];
        return cell?.kind === "black" ? cell.clue : undefined;
    };
    const unit = (k: number) => [k, ...sight(desc, k)];
    const listed = (cells: number[]) => cells.every((k) => focus.has(k));

    switch (step.technique) {
        case 1: {
            // OnlyOneWayToLight: the target is the dark cell, withheld when the bulb goes on it
            if (target.length === 1) return { key: "hint.onlyWay.cell", params: at(target[0]) };
            if (target.length > 0) return undefined;
            // Then the focus is that cell and every cell that could shine on it, and the others
            // are lit or ruled out, so it is the one cell of them still open
            const lit = computeLighting(desc, grid);
            const dark = step.focus.filter(
                (k) =>
                    desc.cells[k]?.kind === "white" &&
                    grid[k] === "empty" &&
                    !lit[k] &&
                    unit(k).length === focus.size &&
                    listed(unit(k)),
            );
            return dark.length === 1
                ? { key: "hint.onlyWay.self", params: at(dark[0]) }
                : undefined;
        }
        case 2:
        case 3: {
            // ClueSatisfied and ClueForced: the target is the number
            if (target.length !== 1) return undefined;
            const number = clueAt(target[0]);
            if (number === undefined) return undefined;
            const params = { number, ...at(target[0]) };
            if (step.technique === 3) return { key: "hint.clueForced", params };
            return {
                key: number === 0 ? "hint.clueSatisfied.zero" : "hint.clueSatisfied.some",
                params,
            };
        }
        case 4: {
            // SetExclusion: the target is the unit's open cells, one of which must hold a bulb,
            // and the ? cell is the one a bulb would rule them all out from
            if (target.length === 0) return undefined;
            const clues = step.focus.filter((k) => clueAt(k) !== undefined);
            if (clues.length === 1) {
                const c = clues[0];
                const beside = neighbours(desc, c).filter((j) => desc.cells[j].kind === "white");
                if (!listed(beside) || !target.every((k) => beside.includes(k))) return undefined;
                const params = { number: clueAt(c)!, ...at(c) };
                // The ? cell can itself be one of the number's cells
                const outside = step.focus.some((k) => k !== c && !beside.includes(k));
                return {
                    key: outside ? "hint.setExclusion.clue" : "hint.setExclusion.clueBeside",
                    params,
                };
            }
            if (clues.length > 0) return undefined;
            // A dark cell: its unit lies whole in the focus, holds the outlined cells and leaves
            // out only the ? cell. Two cells of one line can share a unit, and then either names it.
            const lit = computeLighting(desc, grid);
            const dark = step.focus.find((k) => {
                const cells = unit(k);
                return (
                    !lit[k] &&
                    cells.length === focus.size - 1 &&
                    listed(cells) &&
                    target.every((t) => cells.includes(t))
                );
            });
            return dark === undefined
                ? undefined
                : { key: "hint.setExclusion.dark", params: at(dark) };
        }
    }
    return undefined;
}

// Violation kinds for the board. "clash" = a bulb that sees another or sits on a black cell.
// "over" = a clue with too many bulbs. Both are wrong the moment they happen. A clue short of
// bulbs is "under" while enough of its neighbours are still free to meet it, which the board
// paints as waiting, never red, and "impossible" once they are not. An unlit cell is reported,
// as "impossible", only once nothing in its line of sight can take a bulb any more; until then
// it is a grid in progress, and the finished check is `solved`.
function toViolations(
    desc: LightUpDescription,
    grid: LightUpCell[],
    violations: LightUpViolation[],
): Violation[] {
    const out: Violation[] = [];
    for (const v of violations) {
        switch (v.kind) {
            case "bulb_sees_bulb":
                out.push({ keys: [v.a, v.b], kind: "clash" });
                break;
            case "bulb_on_black":
                out.push({ keys: [v.cell], kind: "clash" });
                break;
            case "clue_count": {
                if (v.actual > v.expected) {
                    out.push({ keys: [v.clue], kind: "over" });
                    break;
                }
                const free = neighbours(desc, v.clue).filter(
                    (j) => desc.cells[j].kind === "white" && grid[j] === "empty",
                ).length;
                out.push({
                    keys: [v.clue],
                    kind: v.actual + free < v.expected ? "impossible" : "under",
                });
                break;
            }
            case "unlit":
                if (!canStillBeLit(desc, grid, v.cell)) {
                    out.push({ keys: [v.cell], kind: "impossible" });
                }
                break;
        }
    }
    return out;
}

export const lightUp: DailyGame<LightUpDescription, LightUpCell[]> = {
    id: LIGHT_UP_GAME_ID,
    parse: parseDescription,
    empty: emptyGrid,
    elements(desc): GameElement[] {
        return desc.cells.map((cell, i) => ({
            key: i,
            kind: "cell",
            x: i % desc.width,
            y: Math.floor(i / desc.width),
            w: 1,
            h: 1,
            label: cell.kind === "black" && cell.clue !== undefined ? String(cell.clue) : undefined,
        }));
    },
    tap(desc, grid, key) {
        if (desc.cells[key]?.kind !== "white") return grid;
        const next = [...grid];
        next[key] = cycleCell(next[key]);
        return next;
    },
    apply(desc, grid, key, value) {
        if (desc.cells[key]?.kind !== "white") return grid;
        const next = [...grid];
        next[key] = value === 1 ? "bulb" : "dot";
        return next;
    },
    // A lit cell can take no bulb, so a hint key there is settled by the beam as much as by a
    // mark: a hint asking for the bulb that lights a cell retires once the cell is lit.
    hintKeyStatus(desc, grid, key): HintKeyStatus {
        if (desc.cells[key]?.kind !== "white") return "context";
        if (grid[key] !== "empty") return "done";
        return computeLighting(desc, grid)[key] ? "done" : "todo";
    },
    filled(_desc, grid) {
        const out: [number, number][] = [];
        grid.forEach((c, i) => {
            if (c === "bulb") out.push([i, 1]);
            else if (c === "dot") out.push([i, 0]);
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
            if (c !== "empty") out.set(i, c);
        });
        return out;
    },
    lit(desc, grid) {
        const out = new Set<number>();
        computeLighting(desc, grid).forEach((on, i) => {
            if (on) out.add(i);
        });
        return out;
    },
    hintCaption,
};
