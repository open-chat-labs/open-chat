import { describe, expect, test } from "vitest";
import {
    checkRules,
    cycleEdge,
    emptyGrid,
    fromGridBytes,
    isSolved,
    loopy,
    loopyCellEdges,
    loopyCellKey,
    loopyCellLines,
    loopyEdgeCount,
    parseDescription,
    toGridBytes,
    type LoopyDescription,
    type LoopyEdge,
} from "./loopy";

// '.' no clue, '0'-'3' a clue.
function descBytes(rows: string[]): number[] {
    const bytes = [1, rows[0].length, rows.length];
    for (const row of rows) {
        for (const ch of row) {
            bytes.push(ch === "." ? 0xff : Number(ch));
        }
    }
    return bytes;
}

function desc(rows: string[]): LoopyDescription {
    return parseDescription(descBytes(rows));
}

function grid(d: LoopyDescription, lines: number[], crosses: number[] = []): LoopyEdge[] {
    const g = emptyGrid(d);
    for (const e of lines) g[e] = 1;
    for (const e of crosses) g[e] = 2;
    return g;
}

// 2x2: horizontals 0-1 (top), 2-3 (middle), 4-5 (bottom); verticals 6-8 (row 0), 9-11 (row 1).
const blank2 = desc(["..", ".."]);
const twos2 = desc(["22", "22"]);
// The loop around the whole 2x2.
const ring2 = [0, 1, 4, 5, 6, 8, 9, 11];

// 3x3: horizontals 0-11, verticals 12-23.
const blank3 = desc(["...", "...", "..."]);

describe("parseDescription", () => {
    test("round-trips a 3x3", () => {
        const d = desc([".1.", "3.0", "..2"]);
        expect(d.width).toBe(3);
        expect(d.height).toBe(3);
        expect(d.clues).toEqual([undefined, 1, undefined, 3, undefined, 0, undefined, undefined, 2]);
        expect(parseDescription(new Uint8Array(descBytes([".1.", "3.0", "..2"])))).toEqual(d);
    });

    test("rejects the wrong version, a short buffer and a bad clue", () => {
        const bytes = descBytes(["..", ".."]);
        expect(() => parseDescription([2, ...bytes.slice(1)])).toThrow("malformed loopy description");
        expect(() => parseDescription(bytes.slice(0, -1))).toThrow("malformed loopy description");
        expect(() => parseDescription([1, 2])).toThrow("malformed loopy description");
        expect(() => parseDescription([1, 0, 2])).toThrow("malformed loopy description");
        bytes[4] = 4;
        expect(() => parseDescription(bytes)).toThrow("malformed loopy description");
    });
});

describe("edge indexing", () => {
    test("horizontal edges come first, then verticals", () => {
        expect(loopyEdgeCount(blank2)).toBe(12);
        expect(loopyEdgeCount(blank3)).toBe(24);
        expect(loopyCellKey(blank2, 3)).toBe(15);
        // top, right, bottom, left
        expect(loopyCellEdges(blank2, 0)).toEqual([0, 7, 2, 6]);
        expect(loopyCellEdges(blank2, 3)).toEqual([3, 11, 5, 10]);
        expect(loopyCellEdges(blank3, 0)).toEqual([0, 13, 3, 12]);
        expect(loopyCellEdges(blank3, 8)).toEqual([8, 23, 11, 22]);
    });

    test("elements map edges onto thin rects and cells after them", () => {
        const els = loopy.elements(twos2);
        expect(els).toHaveLength(16);
        expect(els[0]).toEqual({ key: 0, kind: "edge", x: 0, y: 0, w: 1, h: 0 });
        expect(els[5]).toEqual({ key: 5, kind: "edge", x: 1, y: 2, w: 1, h: 0 });
        expect(els[6]).toEqual({ key: 6, kind: "edge", x: 0, y: 0, w: 0, h: 1 });
        expect(els[8]).toEqual({ key: 8, kind: "edge", x: 2, y: 0, w: 0, h: 1 });
        expect(els[9]).toEqual({ key: 9, kind: "edge", x: 0, y: 1, w: 0, h: 1 });
        expect(els[12]).toEqual({ key: 12, kind: "cell", x: 0, y: 0, w: 1, h: 1, label: "2" });
        expect(els[15]).toEqual({ key: 15, kind: "cell", x: 1, y: 1, w: 1, h: 1, label: "2" });
        expect(loopy.elements(blank2)[12].label).toBeUndefined();
    });
});

describe("tap and apply", () => {
    test("cycleEdge unknown -> line -> cross -> unknown", () => {
        expect(cycleEdge(0)).toBe(1);
        expect(cycleEdge(1)).toBe(2);
        expect(cycleEdge(2)).toBe(0);
    });

    test("tap cycles edges and ignores cells", () => {
        const empty = loopy.empty(blank2);
        const a = loopy.tap(blank2, empty, 3);
        expect(a[3]).toBe(1);
        expect(empty[3]).toBe(0);
        const b = loopy.tap(blank2, a, 3);
        expect(b[3]).toBe(2);
        expect(loopy.tap(blank2, b, 3)[3]).toBe(0);
        expect(loopy.tap(blank2, empty, 12)).toBe(empty);
    });

    test("apply, filled and marks agree on the conclusion encoding", () => {
        let s = loopy.empty(blank2);
        s = loopy.apply(blank2, s, 0, 1);
        s = loopy.apply(blank2, s, 7, 0);
        s = loopy.apply(blank2, s, 12, 1);
        expect(s).toHaveLength(12);
        expect(loopy.filled(blank2, s)).toEqual([
            [0, 1],
            [7, 0],
        ]);
        expect(loopy.marks(blank2, s)).toEqual(
            new Map([
                [0, "line"],
                [7, "cross"],
            ]),
        );
    });
});

describe("checkRules", () => {
    test("an empty grid breaks nothing", () => {
        expect(checkRules(twos2, emptyGrid(twos2))).toEqual([]);
        expect(isSolved(twos2, emptyGrid(twos2))).toBe(false);
    });

    test("a clue with too many lines", () => {
        const d = desc(["1.", ".."]);
        expect(checkRules(d, grid(d, [0, 6]))).toEqual([
            { kind: "clue_count", cell: 0, expected: 1, lines: 2, possible: 4 },
        ]);
    });

    test("a clue is only short once its open edges cannot reach it", () => {
        const d = desc(["3.", ".."]);
        expect(checkRules(d, grid(d, [], [0]))).toEqual([]);
        expect(checkRules(d, grid(d, [], [0, 6]))).toEqual([
            { kind: "clue_count", cell: 0, expected: 3, lines: 0, possible: 2 },
        ]);
    });

    test("a dot with three lines", () => {
        expect(checkRules(blank2, grid(blank2, [0, 1, 7]))).toEqual([
            { kind: "dot_degree", dot: 1, degree: 3, edges: [1, 7, 0] },
        ]);
    });

    test("a dot with one line is a dead end only when nothing else is open", () => {
        expect(checkRules(blank2, grid(blank2, [0]))).toEqual([]);
        expect(checkRules(blank2, grid(blank2, [0], [6]))).toEqual([
            { kind: "dot_degree", dot: 0, degree: 1, edges: [0] },
        ]);
    });

    test("two separate squares report the later one as an extra loop", () => {
        const g = grid(blank3, [0, 13, 3, 12, 8, 23, 11, 22]);
        expect(checkRules(blank3, g)).toEqual([{ kind: "extra_loop", edges: [8, 11, 22, 23] }]);
        expect(isSolved(blank3, g)).toBe(false);
    });

    test("the smaller loop is the extra one", () => {
        // Ring around cells 0 and 1 plus a square around cell 8.
        const g = grid(blank3, [0, 1, 3, 4, 12, 14, 8, 23, 11, 22]);
        expect(checkRules(blank3, g)).toEqual([{ kind: "extra_loop", edges: [8, 11, 22, 23] }]);
    });

    test("loops are not counted while some dot is still open-ended", () => {
        // Two squares plus a stray line off one of them.
        const g = grid(blank3, [0, 13, 3, 12, 8, 23, 11, 22, 1]);
        const v = checkRules(blank3, g);
        expect(v.find((x) => x.kind === "extra_loop")).toBeUndefined();
        expect(v).toEqual([{ kind: "dot_degree", dot: 1, degree: 3, edges: [1, 13, 0] }]);
    });

    test("a grid of the wrong length counts as empty", () => {
        const d = desc(["1.", ".."]);
        expect(checkRules(d, [1, 1, 1])).toEqual([]);
    });
});

describe("solved", () => {
    test("a single loop meeting every clue", () => {
        const g = grid(twos2, ring2);
        expect(checkRules(twos2, g)).toEqual([]);
        expect(isSolved(twos2, g)).toBe(true);
        expect(loopy.solved(twos2, g)).toBe(true);
        expect(loopyCellLines(twos2, g)).toEqual([2, 2, 2, 2]);
    });

    test("crosses on the unused edges do not matter", () => {
        expect(isSolved(twos2, grid(twos2, ring2, [2, 3, 7, 10]))).toBe(true);
    });

    test("a loop that leaves a clue short is not solved, even with no violation yet", () => {
        const d = desc(["3.", ".."]);
        const g = grid(d, ring2);
        expect(checkRules(d, g)).toEqual([]);
        expect(isSolved(d, g)).toBe(false);
        expect(isSolved(d, grid(d, ring2, [2, 7]))).toBe(false);
    });

    test("a loop around one cell with the rest unknown is solved", () => {
        const d = desc([".1", "10"]);
        expect(isSolved(d, grid(d, [0, 7, 2, 6]))).toBe(true);
    });
});

describe("loopy DailyGame", () => {
    test("check maps rule violations onto keys", () => {
        const d = desc(["1.", ".."]);
        expect(loopy.check(d, grid(d, [0, 6]))).toEqual([{ keys: [12], kind: "clue_count" }]);
        expect(loopy.check(blank2, grid(blank2, [0, 1, 7]))).toEqual([
            { keys: [1, 7, 0], kind: "dot_degree" },
        ]);
        expect(loopy.check(blank3, grid(blank3, [0, 13, 3, 12, 8, 23, 11, 22]))).toEqual([
            { keys: [8, 11, 22, 23], kind: "extra_loop" },
        ]);
    });

    test("bytes: lines are 1, crosses and unknowns 0, and only 1 comes back", () => {
        const g = grid(twos2, ring2, [2, 3]);
        const bytes = loopy.toBytes(twos2, g);
        expect(bytes).toEqual(Uint8Array.from([1, 1, 0, 0, 1, 1, 1, 0, 1, 1, 0, 1]));
        expect(toGridBytes(g)).toEqual(bytes);
        expect(loopy.fromBytes(twos2, bytes)).toEqual(grid(twos2, ring2));
        expect(fromGridBytes([0, 2])).toEqual([0, 1]);
        expect(loopy.fromBytes(twos2, bytes.slice(1))).toBeUndefined();
    });
});
