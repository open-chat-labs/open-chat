// Light Up (Akari) rule checker, a port of backend/libraries/light_up `check_rules`.
//
// Wire format. Description: [version = 1, width, height, width*height cell bytes row-major]
// where 0x00 = white, 0x10 = black unnumbered, 0x11..0x15 = black with clue 0..4.
// Grid: width*height bytes row-major, 1 = bulb, 0 = no bulb. Cell key = y*width+x.

import { LIGHT_UP_GAME_ID } from "../../domain/dailyPuzzle";
import type { DailyGame, GameElement, Violation } from "./types";

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

// Violation kinds for the board: "clash" = a bulb that sees another or sits on a black cell,
// "over" / "under" = a clue with too many / too few bulbs, "unlit" = a white cell nothing lights.
function toViolations(violations: LightUpViolation[]): Violation[] {
    return violations.map((v) => {
        switch (v.kind) {
            case "bulb_sees_bulb":
                return { keys: [v.a, v.b], kind: "clash" };
            case "bulb_on_black":
                return { keys: [v.cell], kind: "clash" };
            case "clue_count":
                return { keys: [v.clue], kind: v.actual > v.expected ? "over" : "under" };
            case "unlit":
                return { keys: [v.cell], kind: "unlit" };
        }
    });
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
    filled(_desc, grid) {
        const out: [number, number][] = [];
        grid.forEach((c, i) => {
            if (c === "bulb") out.push([i, 1]);
            else if (c === "dot") out.push([i, 0]);
        });
        return out;
    },
    check(desc, grid) {
        return toViolations(checkRules(desc, grid));
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
};
