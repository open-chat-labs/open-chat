// CHAT Rooms rule checker, a port of backend/libraries/chat_rooms `check_rules`.
//
// Wire format. Description: [version = 1, size, size, size*size room ids row-major], every id in
// 0..size present. Grid: size*size bytes row-major, 1 = logo, 0 = no logo. Cell key = y*size+x,
// and conclusion values are 1 (logo) or 0 (no logo). The player's crosses are their own notes:
// they submit as 0, the same as a cell left alone.

import type { DailyGame, GameElement, HintKeyStatus, Violation } from "./types";

export type ChatRoomsCell = "empty" | "cross" | "logo";
export type ChatRoomsDescription = {
    size: number;
    /** size*size row-major room ids. */
    rooms: number[];
};
export type ChatRoomsViolation =
    /** A row, column or room with more than one logo; `cells` are the logos. */
    | { kind: "row"; row: number; cells: number[] }
    | { kind: "column"; column: number; cells: number[] }
    | { kind: "room"; room: number; cells: number[] }
    /** Two logos touching, across, down or diagonally. a < b. */
    | { kind: "touching"; a: number; b: number };

const FORMAT_VERSION = 1;
const MIN_SIZE = 5;
const MAX_SIZE = 9;

function malformed(): Error {
    return new Error("malformed chat rooms description");
}

export function parseDescription(bytes: Uint8Array | number[]): ChatRoomsDescription {
    if (bytes.length < 3 || bytes[0] !== FORMAT_VERSION) {
        throw malformed();
    }
    const size = bytes[1];
    if (bytes[2] !== size || size < MIN_SIZE || size > MAX_SIZE) {
        throw malformed();
    }
    if (bytes.length !== 3 + size * size) {
        throw malformed();
    }
    const rooms = Array.from(bytes.slice(3));
    const seen = new Set(rooms);
    if (rooms.some((r) => r >= size) || seen.size !== size) {
        throw malformed();
    }
    return { size, rooms };
}

export function emptyGrid(desc: ChatRoomsDescription): ChatRoomsCell[] {
    return desc.rooms.map(() => "empty");
}

/** The up to eight cells touching `i`, diagonals included. */
function around(size: number, i: number): number[] {
    const x = i % size;
    const y = Math.floor(i / size);
    const out: number[] = [];
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if ((dx !== 0 || dy !== 0) && nx >= 0 && nx < size && ny >= 0 && ny < size) {
                out.push(ny * size + nx);
            }
        }
    }
    return out;
}

// Mirrors the Rust check_rules exactly: rows, then columns, then rooms, each in index order, then
// every touching pair once in reading order. A group with no logo yet is unfinished, never wrong.
// A grid of the wrong length counts as empty.
export function checkRules(
    desc: ChatRoomsDescription,
    grid: ChatRoomsCell[],
): ChatRoomsViolation[] {
    const n = desc.size;
    const logo = (i: number) => grid.length === n * n && grid[i] === "logo";
    const out: ChatRoomsViolation[] = [];

    const rows: number[][] = Array.from({ length: n }, () => []);
    const columns: number[][] = Array.from({ length: n }, () => []);
    const rooms: number[][] = Array.from({ length: n }, () => []);
    for (let i = 0; i < n * n; i++) {
        if (!logo(i)) continue;
        rows[Math.floor(i / n)].push(i);
        columns[i % n].push(i);
        rooms[desc.rooms[i]].push(i);
    }
    rows.forEach((cells, row) => {
        if (cells.length > 1) out.push({ kind: "row", row, cells });
    });
    columns.forEach((cells, column) => {
        if (cells.length > 1) out.push({ kind: "column", column, cells });
    });
    rooms.forEach((cells, room) => {
        if (cells.length > 1) out.push({ kind: "room", room, cells });
    });
    for (let a = 0; a < n * n; a++) {
        if (!logo(a)) continue;
        for (const b of around(n, a)) {
            if (b > a && logo(b)) out.push({ kind: "touching", a, b });
        }
    }
    return out;
}

/**
 * Every cell a placed logo rules out: its row, its column, its room and the eight cells around
 * it, less any cell that holds a logo itself. The board crosses these out for the player. They
 * are derived from the logos every time and never stored, so taking a logo away takes its
 * crosses with it.
 */
export function ruledOut(desc: ChatRoomsDescription, grid: ChatRoomsCell[]): Set<number> {
    const n = desc.size;
    const out = new Set<number>();
    if (grid.length !== n * n) return out;
    const logos = grid.flatMap((c, i) => (c === "logo" ? [i] : []));
    for (const l of logos) {
        const row = Math.floor(l / n);
        const column = l % n;
        for (let i = 0; i < n * n; i++) {
            if (Math.floor(i / n) === row || i % n === column || desc.rooms[i] === desc.rooms[l]) {
                out.add(i);
            }
        }
        around(n, l).forEach((i) => out.add(i));
    }
    logos.forEach((l) => out.delete(l));
    return out;
}

/** Exactly one logo in every row, column and room, and none touching. */
export function isSolved(desc: ChatRoomsDescription, grid: ChatRoomsCell[]): boolean {
    const n = desc.size;
    return (
        grid.length === n * n &&
        grid.filter((c) => c === "logo").length === n &&
        checkRules(desc, grid).length === 0
    );
}

export function toGridBytes(grid: ChatRoomsCell[]): Uint8Array {
    return Uint8Array.from(grid, (c) => (c === "logo" ? 1 : 0));
}

export function fromGridBytes(bytes: Uint8Array | number[]): ChatRoomsCell[] {
    return Array.from(bytes, (b) => (b === 1 ? "logo" : "empty"));
}

/** LinkedIn's order: the first tap crosses a cell out, the second places a logo. */
export function cycleCell(cell: ChatRoomsCell): ChatRoomsCell {
    switch (cell) {
        case "empty":
            return "cross";
        case "cross":
            return "logo";
        case "logo":
            return "empty";
    }
}

/** The player's own marks as (key, value) pairs: 1 for a logo, 0 for their cross. */
function filledPairs(grid: ChatRoomsCell[]): [number, number][] {
    const out: [number, number][] = [];
    grid.forEach((c, i) => {
        if (c === "logo") out.push([i, 1]);
        else if (c === "cross") out.push([i, 0]);
    });
    return out;
}

// Every broken rule is wrong the moment it happens, so all of them paint the logos involved as a
// "clash".
function toViolations(violations: ChatRoomsViolation[]): Violation[] {
    return violations.map((v) =>
        v.kind === "touching"
            ? { keys: [v.a, v.b], kind: "clash" }
            : { keys: v.cells, kind: "clash" },
    );
}

export const chatRooms: DailyGame<ChatRoomsDescription, ChatRoomsCell[]> = {
    id: "chat_rooms",
    parse: parseDescription,
    empty: emptyGrid,
    elements(desc): GameElement[] {
        return desc.rooms.map((_, i) => ({
            key: i,
            kind: "cell",
            x: i % desc.size,
            y: Math.floor(i / desc.size),
            w: 1,
            h: 1,
        }));
    },
    tap(desc, grid, key) {
        if (key < 0 || key >= desc.rooms.length) return grid;
        const next = [...grid];
        next[key] = cycleCell(next[key]);
        return next;
    },
    apply(desc, grid, key, value) {
        if (key < 0 || key >= desc.rooms.length) return grid;
        const next = [...grid];
        next[key] = value === 1 ? "logo" : "cross";
        return next;
    },
    filled: (_desc, grid) => filledPairs(grid),
    // The player's own marks, and the cells their logos rule out as "no logo": the server's
    // premise walk would otherwise sell a step crossing out cells the board already shows crossed
    hintFilled(desc, grid) {
        const out = filledPairs(grid);
        for (const i of ruledOut(desc, grid)) {
            if (grid[i] === "empty") out.push([i, 0]);
        }
        return out;
    },
    // A cell the board has crossed out for the player is as done as one they crossed themselves
    hintKeyStatus(desc, grid, key): HintKeyStatus {
        return grid[key] !== "empty" || ruledOut(desc, grid).has(key) ? "done" : "todo";
    },
    check(desc, grid) {
        return toViolations(checkRules(desc, grid));
    },
    solved: isSolved,
    toBytes(_desc, grid) {
        return toGridBytes(grid);
    },
    fromBytes(desc, bytes) {
        return bytes.length === desc.rooms.length ? fromGridBytes(bytes) : undefined;
    },
    marks(_desc, grid) {
        const out = new Map<number, string>();
        grid.forEach((c, i) => {
            if (c !== "empty") out.set(i, c);
        });
        return out;
    },
    lit: ruledOut,
};
