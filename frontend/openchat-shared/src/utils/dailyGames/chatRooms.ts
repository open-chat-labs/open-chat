// CHAT Rooms rule checker, a port of backend/libraries/chat_rooms `check_rules`.
//
// Wire format. Description: [version = 1, size, size, size*size room ids row-major], every id in
// 0..size present. Grid: size*size bytes row-major, 1 = logo, 0 = no logo. Cell key = y*size+x,
// and conclusion values are 1 (logo) or 0 (no logo). The player's crosses are their own notes:
// they submit as 0, the same as a cell left alone.

import type {
    DailyGame,
    GameElement,
    HintCaption,
    HintCaptionParam,
    HintKeyStatus,
    HintStep,
    Violation,
} from "./types";

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

type GroupKind = "row" | "column" | "room";
type Group = { kind: GroupKind; index: number; cells: number[] };

function groups(desc: ChatRoomsDescription): Group[] {
    const n = desc.size;
    const out: Group[] = [];
    for (let i = 0; i < n; i++) {
        out.push({ kind: "row", index: i, cells: Array.from({ length: n }, (_, c) => i * n + c) });
        out.push({
            kind: "column",
            index: i,
            cells: Array.from({ length: n }, (_, r) => r * n + i),
        });
        out.push({
            kind: "room",
            index: i,
            cells: desc.rooms.flatMap((room, k) => (room === i ? [k] : [])),
        });
    }
    return out;
}

/** The room's colour, named for the sentence: "the orange room". */
function roomName(room: number): HintCaptionParam {
    return { key: `room.${room}` };
}

const upper = (kind: GroupKind) => kind.charAt(0).toUpperCase() + kind.slice(1);

/**
 * The sentence for a served step, naming the row, column or room it is about. The step's focus
 * holds every cell of the groups it reasons about (invariant 23), so those groups are found as
 * the ones holding its outlined cells and lying whole in its focus. Undefined for a step that
 * cannot be read that way, which then gets the technique's fixed sentence.
 */
export function hintCaption(
    desc: ChatRoomsDescription,
    grid: ChatRoomsCell[],
    step: HintStep,
): HintCaption | undefined {
    const n = desc.size;
    const focus = new Set(step.focus);
    const target = step.target;
    const all = groups(desc);
    const whole = (g: Group) => g.cells.every((k) => focus.has(k));
    const touched = (kind: GroupKind) =>
        all.filter((g) => g.kind === kind && g.cells.some((k) => target.includes(k)));
    const line = (g: Group): HintCaptionParam => g.index + 1;

    switch (step.technique) {
        case 1: {
            // Shadow: the target is the CHAT
            if (target.length !== 1) return undefined;
            const l = target[0];
            return {
                key: "hint.shadow",
                params: {
                    row: Math.floor(l / n) + 1,
                    column: (l % n) + 1,
                    room: roomName(desc.rooms[l]),
                },
            };
        }
        case 2: {
            // LastCell: the focus is the whole row, column or room
            const g = all.find((g) => g.cells.length === focus.size && whole(g));
            if (g === undefined) return undefined;
            // A one-cell room's only cell is its conclusion, which the server withholds as target
            if (target.length === 0)
                return { key: "hint.lastCell.single", params: { room: roomName(g.index) } };
            return g.kind === "room"
                ? { key: "hint.lastCell.room", params: { room: roomName(g.index) } }
                : { key: `hint.lastCell.${g.kind}`, params: { line: line(g) } };
        }
        case 3:
        case 4: {
            // Confined and Pigeonhole: some rooms (or lines) hold the outlined cells and are listed
            // whole; their outlined cells sit in as many lines (or rooms); the rest of the focus is
            // what the step rules out, and lies in those lines (or rooms)
            if (target.length === 0) return undefined;
            // Both readings can fit the same focus ("room 4's open cells are all in row 3" and
            // "row 3's open cells are all in room 4"). The server serves a step only once what it
            // rests on is on the board, so the groups it is about have every cell but the outlined
            // ones marked or crossed out already: the other reading's groups still have open cells.
            const auto = ruledOut(desc, grid);
            const closed = (k: number) => grid[k] !== "empty" || auto.has(k);
            for (const setKind of ["room", "row", "column"] as GroupKind[]) {
                const set = touched(setKind);
                if (set.length === 0 || !set.every(whole)) continue;
                if (!set.every((g) => g.cells.every((k) => target.includes(k) || closed(k))))
                    continue;
                const inSet = new Set(set.flatMap((g) => g.cells));
                const ruled = step.focus.filter((k) => !inSet.has(k));
                for (const lineKind of (setKind === "room"
                    ? ["row", "column"]
                    : ["room"]) as GroupKind[]) {
                    const lines = touched(lineKind);
                    if (lines.length !== set.length) continue;
                    if (!ruled.every((k) => lines.some((g) => g.cells.includes(k)))) continue;
                    const name = step.technique === 3 ? "confined" : "pigeonhole";
                    if (step.technique === 3) {
                        return setKind === "room"
                            ? {
                                  key: `hint.${name}.roomIn${upper(lineKind)}`,
                                  params: { room: roomName(set[0].index), line: line(lines[0]) },
                              }
                            : {
                                  key: `hint.${name}.${setKind}InRoom`,
                                  params: { line: line(set[0]), room: roomName(lines[0].index) },
                              };
                    }
                    return setKind === "room"
                        ? {
                              key: `hint.${name}.roomsIn${upper(lineKind)}s`,
                              params: { count: set.length, lines: lines.map((g) => g.index + 1) },
                          }
                        : {
                              key: `hint.${name}.${setKind}sInRooms`,
                              params: { count: set.length, lines: set.map((g) => g.index + 1) },
                          };
                }
            }
            return undefined;
        }
        case 5: {
            // Blocked: the focus is the whole group the ? cell would empty, and the ? cell
            const g = all.find(
                (g) =>
                    g.cells.length === focus.size - 1 &&
                    whole(g) &&
                    target.length > 0 &&
                    target.every((k) => g.cells.includes(k)),
            );
            if (g === undefined) return undefined;
            return g.kind === "room"
                ? { key: "hint.blocked.room", params: { room: roomName(g.index) } }
                : { key: `hint.blocked.${g.kind}`, params: { line: line(g) } };
        }
    }
    return undefined;
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
    hintCaption,
};
