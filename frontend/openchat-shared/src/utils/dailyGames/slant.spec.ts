import { describe, expect, test } from "vitest";
import {
    checkRules,
    cycleCell,
    emptyGrid,
    fromGridBytes,
    isSolved,
    parseDescription,
    slant,
    slantVertexLines,
    toGridBytes,
    vertexNeighbours,
    type SlantCell,
    type SlantDescription,
} from "./slant";

// Vertex rows of (w+1) characters, (h+1) rows: '.' no clue, '0'-'4' a clue.
function descBytes(rows: string[]): number[] {
    const bytes = [1, rows[0].length - 1, rows.length - 1];
    for (const row of rows) {
        for (const ch of row) {
            bytes.push(ch === "." ? 0xff : Number(ch));
        }
    }
    return bytes;
}

function desc(rows: string[]): SlantDescription {
    return parseDescription(descBytes(rows));
}

// '\' backslash, '/' slash, '.' undecided.
function grid(rows: string[]): SlantCell[] {
    return rows
        .join("")
        .split("")
        .map((ch) => (ch === "\\" ? 1 : ch === "/" ? 2 : 0));
}

const clueless3 = desc(["....", "....", "....", "...."]);
// All backslashes solve this: corner (0,0) touches one, (1,1) touches two, (3,0) none.
const diag3 = desc(["1..0", ".2..", "....", "...."]);
const allBack3 = grid(["\\\\\\", "\\\\\\", "\\\\\\"]);

describe("parseDescription", () => {
    test("round-trips a 3x3", () => {
        const d = desc(["1..0", ".2..", "....", "...4"]);
        expect(d.width).toBe(3);
        expect(d.height).toBe(3);
        expect(d.clues).toHaveLength(16);
        expect(d.clues[0]).toBe(1);
        expect(d.clues[3]).toBe(0);
        expect(d.clues[5]).toBe(2);
        expect(d.clues[15]).toBe(4);
        expect(d.clues[1]).toBeUndefined();
        expect(
            parseDescription(new Uint8Array(descBytes(["1..0", ".2..", "....", "...4"]))),
        ).toEqual(d);
    });

    test("rejects the wrong version", () => {
        const bytes = descBytes(["....", "....", "....", "...."]);
        bytes[0] = 2;
        expect(() => parseDescription(bytes)).toThrow("malformed slant description");
    });

    test("rejects the wrong length", () => {
        const bytes = descBytes(["....", "....", "....", "...."]);
        expect(() => parseDescription(bytes.slice(0, -1))).toThrow("malformed slant description");
        expect(() => parseDescription([...bytes, 0xff])).toThrow("malformed slant description");
        expect(() => parseDescription([1, 3])).toThrow("malformed slant description");
    });

    test("rejects sizes below 2", () => {
        expect(() => parseDescription([1, 1, 2, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff])).toThrow(
            "malformed slant description",
        );
    });

    test("rejects a clue above 4", () => {
        const bytes = descBytes(["....", "....", "....", "...."]);
        bytes[5] = 5;
        expect(() => parseDescription(bytes)).toThrow("malformed slant description");
    });
});

describe("vertexNeighbours", () => {
    test("interior vertex lists four cells in Tatham order", () => {
        expect(vertexNeighbours(clueless3, 1, 1)).toEqual([
            [0, 1],
            [3, 2],
            [4, 1],
            [1, 2],
        ]);
    });

    test("corners and edges drop out-of-range cells", () => {
        expect(vertexNeighbours(clueless3, 0, 0)).toEqual([[0, 1]]);
        expect(vertexNeighbours(clueless3, 3, 0)).toEqual([[2, 2]]);
        expect(vertexNeighbours(clueless3, 0, 3)).toEqual([[6, 2]]);
        expect(vertexNeighbours(clueless3, 3, 3)).toEqual([[8, 1]]);
        expect(vertexNeighbours(clueless3, 1, 0)).toEqual([
            [0, 2],
            [1, 1],
        ]);
    });
});

describe("cycleCell", () => {
    test("empty -> backslash -> slash -> empty", () => {
        expect(cycleCell(0)).toBe(1);
        expect(cycleCell(1)).toBe(2);
        expect(cycleCell(2)).toBe(0);
    });
});

describe("checkRules", () => {
    test("empty grid is incomplete, not wrong", () => {
        expect(checkRules(diag3, emptyGrid(diag3))).toEqual([]);
        expect(isSolved(diag3, emptyGrid(diag3))).toBe(false);
    });

    test("solved grid has no violations", () => {
        expect(checkRules(diag3, allBack3)).toEqual([]);
        expect(isSolved(diag3, allBack3)).toBe(true);
    });

    test("one undecided cell is not solved", () => {
        const g = grid(["\\\\\\", "\\.\\", "\\\\\\"]);
        expect(checkRules(diag3, g)).toEqual([]);
        expect(isSolved(diag3, g)).toBe(false);
    });

    test("vertex count: too few possible", () => {
        // 2x2, centre vertex (index 4 of the 3x3 vertex grid) clued 4.
        const d = desc(["...", ".4.", "..."]);
        expect(checkRules(d, [0, 0, 0, 0])).toEqual([]);
        expect(checkRules(d, [1, 2, 2, 0])).toEqual([]);
        expect(checkRules(d, [2, 0, 0, 0])).toEqual([
            { kind: "vertex_count", vertex: 4, expected: 4, lines: 0, possible: 3 },
        ]);
    });

    test("vertex count: too many lines", () => {
        const d = desc(["...", ".0.", "..."]);
        expect(checkRules(d, [1, 0, 0, 0])).toEqual([
            { kind: "vertex_count", vertex: 4, expected: 0, lines: 1, possible: 4 },
        ]);
    });

    test("vertex count on a solved-looking grid with one cell flipped", () => {
        const g = grid(["\\\\\\", "\\/\\", "\\\\\\"]);
        expect(checkRules(diag3, g)).toEqual([
            { kind: "vertex_count", vertex: 5, expected: 2, lines: 1, possible: 1 },
        ]);
    });

    test("loop: a diamond around the centre vertex", () => {
        const g = grid(["...", "./\\", ".\\/"]);
        expect(g).toEqual([0, 0, 0, 0, 2, 1, 0, 1, 2]);
        expect(checkRules(clueless3, g)).toEqual([{ kind: "loop", cells: [5, 4, 7, 8] }]);
        // Break the diamond.
        g[8] = 1;
        expect(checkRules(clueless3, g)).toEqual([]);
    });

    test("loop: a 4x4 ring of eight cells", () => {
        const d = desc([".....", ".....", ".....", ".....", "....."]);
        // Vertices (2,0) (3,1) (4,2) (3,3) (2,4) (1,3) (0,2) (1,1) joined in a ring.
        const g = grid(["./\\.", "/..\\", "\\../", ".\\/."]);
        const v = checkRules(d, g);
        expect(v).toHaveLength(1);
        expect(v[0].kind).toBe("loop");
        expect([...(v[0] as { cells: number[] }).cells].sort((a, b) => a - b)).toEqual([
            1, 2, 4, 7, 8, 11, 13, 14,
        ]);
    });

    test("a grid of the wrong length counts as empty", () => {
        expect(checkRules(diag3, [2, 2])).toEqual([]);
        expect(isSolved(diag3, [2, 2])).toBe(false);
    });
});

describe("slantVertexLines", () => {
    test("counts placed diagonals per vertex", () => {
        const lines = slantVertexLines(diag3, allBack3);
        expect(lines[0]).toBe(1);
        expect(lines[3]).toBe(0);
        expect(lines[5]).toBe(2);
        expect(lines[15]).toBe(1);
        expect(slantVertexLines(diag3, emptyGrid(diag3)).every((n) => n === 0)).toBe(true);
    });
});

describe("grid bytes", () => {
    test("round trip, unknown bytes become undecided", () => {
        const g = grid(["\\/.", "./\\", "..."]);
        const bytes = toGridBytes(g);
        expect(bytes).toEqual(Uint8Array.from([1, 2, 0, 0, 2, 1, 0, 0, 0]));
        expect(fromGridBytes(bytes)).toEqual(g);
        expect(fromGridBytes([0, 1, 2, 3, 9])).toEqual([0, 1, 2, 0, 0]);
    });
});

describe("slant DailyGame", () => {
    test("elements are the cells then every vertex, clued or not", () => {
        const els = slant.elements(diag3);
        expect(els).toHaveLength(9 + 16);
        expect(els[4]).toEqual({ key: 4, kind: "cell", x: 1, y: 1, w: 1, h: 1 });
        expect(els[9]).toEqual({ key: 9, kind: "vertex", x: 0, y: 0, w: 0, h: 0, label: "1" });
        expect(els[9 + 5]).toEqual({ key: 14, kind: "vertex", x: 1, y: 1, w: 0, h: 0, label: "2" });
        expect(els[9 + 1]).toEqual({
            key: 10,
            kind: "vertex",
            x: 1,
            y: 0,
            w: 0,
            h: 0,
            label: undefined,
        });
        expect(els[9 + 15]).toMatchObject({ key: 24, kind: "vertex", x: 3, y: 3 });
    });

    test("tap cycles cells and ignores vertices", () => {
        const empty = slant.empty(diag3);
        const a = slant.tap(diag3, empty, 4);
        expect(a[4]).toBe(1);
        expect(empty[4]).toBe(0);
        const b = slant.tap(diag3, a, 4);
        expect(b[4]).toBe(2);
        expect(slant.tap(diag3, b, 4)[4]).toBe(0);
        expect(slant.tap(diag3, empty, 9)).toBe(empty);
        expect(slant.tap(diag3, empty, 24)).toBe(empty);
    });

    test("apply, filled and marks agree on the conclusion encoding", () => {
        let s = slant.empty(diag3);
        s = slant.apply(diag3, s, 0, 1);
        s = slant.apply(diag3, s, 1, 2);
        s = slant.apply(diag3, s, 2, 0);
        s = slant.apply(diag3, s, 9, 1);
        expect(slant.filled(diag3, s)).toEqual([
            [0, 1],
            [1, 2],
        ]);
        expect(slant.marks(diag3, s)).toEqual(
            new Map([
                [0, "backslash"],
                [1, "slash"],
            ]),
        );
    });

    test("check maps vertex violations onto vertex keys and loops onto cells", () => {
        expect(slant.check(diag3, allBack3)).toEqual([]);
        expect(slant.solved(diag3, allBack3)).toBe(true);
        expect(slant.check(diag3, grid(["\\\\\\", "\\/\\", "\\\\\\"]))).toEqual([
            { keys: [9 + 5], kind: "vertex_count" },
        ]);
        expect(slant.check(clueless3, grid(["...", "./\\", ".\\/"]))).toEqual([
            { keys: [5, 4, 7, 8], kind: "loop" },
        ]);
    });

    test("bytes round trip and reject the wrong length", () => {
        const bytes = slant.toBytes(diag3, allBack3);
        expect(bytes).toEqual(Uint8Array.from([1, 1, 1, 1, 1, 1, 1, 1, 1]));
        expect(slant.fromBytes(diag3, bytes)).toEqual(allBack3);
        expect(slant.fromBytes(diag3, bytes.slice(1))).toBeUndefined();
    });

    test("has no derived highlight", () => {
        expect(slant.lit).toBeUndefined();
    });
});
