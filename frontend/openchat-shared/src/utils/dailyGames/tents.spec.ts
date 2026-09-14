import { describe, expect, test } from "vitest";
import {
    checkRules,
    cycleCell,
    emptyGrid,
    fromGridBytes,
    isSolved,
    neighbours,
    parseDescription,
    tents,
    tentsColumnKey,
    tentsRowKey,
    toGridBytes,
    type TentsCell,
    type TentsDescription,
} from "./tents";

// 'T' tree, '.' empty; then the row counts and column counts.
function descBytes(rows: string[], rowCounts: number[], columnCounts: number[]): number[] {
    const bytes = [1, rows[0].length, rows.length];
    for (const row of rows) {
        for (const ch of row) {
            bytes.push(ch === "T" ? 1 : 0);
        }
    }
    return [...bytes, ...rowCounts, ...columnCounts];
}

function desc(rows: string[], rowCounts: number[], columnCounts: number[]): TentsDescription {
    return parseDescription(descBytes(rows, rowCounts, columnCounts));
}

// 'A' tent, 'x' grass, anything else empty.
function grid(rows: string[]): TentsCell[] {
    return rows
        .join("")
        .split("")
        .map((ch) => (ch === "A" ? "tent" : ch === "x" ? "grass" : ""));
}

// 4x4: trees at (0,0), (0,2), (3,2); tents at (1,0), (2,2), (0,3).
const d4 = desc(["T...", "....", "T..T", "...."], [1, 0, 1, 1], [1, 1, 1, 0]);
const solved4 = grid(["TA..", "....", "T.AT", "A..."]);

// 5x5: trees at (2,0), (0,2), (4,2), (1,4); tents at (1,0), (4,1), (1,2), (0,4).
const d5 = desc(["..T..", ".....", "T...T", ".....", ".T..."], [1, 1, 1, 0, 1], [1, 2, 0, 0, 1]);
const solved5 = grid([".AT..", "....A", "TA..T", ".....", "AT..."]);

describe("parseDescription", () => {
    test("round-trips a 4x4", () => {
        expect(d4.width).toBe(4);
        expect(d4.height).toBe(4);
        expect(d4.trees.map((t) => (t ? "T" : ".")).join("")).toBe("T.......T..T....");
        expect(d4.rowCounts).toEqual([1, 0, 1, 1]);
        expect(d4.columnCounts).toEqual([1, 1, 1, 0]);
        expect(
            parseDescription(
                new Uint8Array(
                    descBytes(["T...", "....", "T..T", "...."], [1, 0, 1, 1], [1, 1, 1, 0]),
                ),
            ),
        ).toEqual(d4);
    });

    test("rejects the wrong version", () => {
        const bytes = descBytes(["..", ".."], [0, 0], [0, 0]);
        bytes[0] = 2;
        expect(() => parseDescription(bytes)).toThrow("malformed tents description");
    });

    test("rejects the wrong length", () => {
        const bytes = descBytes(["..", ".."], [0, 0], [0, 0]);
        expect(() => parseDescription(bytes.slice(0, -1))).toThrow("malformed tents description");
        expect(() => parseDescription([...bytes, 0])).toThrow("malformed tents description");
        expect(() => parseDescription([1, 2])).toThrow("malformed tents description");
    });

    test("rejects zero dimensions", () => {
        expect(() => parseDescription([1, 0, 2, 0, 0])).toThrow("malformed tents description");
    });

    test("rejects an unknown cell byte", () => {
        const bytes = descBytes(["..", ".."], [0, 0], [0, 0]);
        bytes[4] = 2;
        expect(() => parseDescription(bytes)).toThrow("malformed tents description");
    });

    test("rejects a count larger than the line", () => {
        expect(() => parseDescription(descBytes(["..", ".."], [3, 0], [0, 0]))).toThrow(
            "malformed tents description",
        );
        expect(() => parseDescription(descBytes(["..", ".."], [0, 0], [0, 3]))).toThrow(
            "malformed tents description",
        );
    });
});

describe("neighbours", () => {
    test("returns in-bounds cells in left, right, up, down order", () => {
        expect(neighbours(d4, 5)).toEqual([4, 6, 1, 9]);
        expect(neighbours(d4, 0)).toEqual([1, 4]);
        expect(neighbours(d4, 15)).toEqual([14, 11]);
    });
});

describe("cycleCell", () => {
    test("empty -> tent -> grass -> empty", () => {
        expect(cycleCell("")).toBe("tent");
        expect(cycleCell("tent")).toBe("grass");
        expect(cycleCell("grass")).toBe("");
    });
});

describe("checkRules", () => {
    test("solved 4x4 has no violations", () => {
        expect(checkRules(d4, solved4)).toEqual([]);
        expect(isSolved(d4, solved4)).toBe(true);
        expect(isSolved(d4, emptyGrid(d4))).toBe(false);
    });

    test("grass counts as no tent", () => {
        expect(checkRules(d4, grid(["TAxx", "xxxx", "TxAT", "Axxx"]))).toEqual([]);
    });

    test("solved 5x5 has no violations", () => {
        expect(checkRules(d5, solved5)).toEqual([]);
        expect(isSolved(d5, solved5)).toBe(true);
    });

    test("empty grid reports the short lines but never a tree still waiting for its tent", () => {
        expect(checkRules(d4, emptyGrid(d4))).toEqual([
            { kind: "row_count", row: 0, expected: 1, actual: 0 },
            { kind: "row_count", row: 2, expected: 1, actual: 0 },
            { kind: "row_count", row: 3, expected: 1, actual: 0 },
            { kind: "column_count", column: 0, expected: 1, actual: 0 },
            { kind: "column_count", column: 1, expected: 1, actual: 0 },
            { kind: "column_count", column: 2, expected: 1, actual: 0 },
        ]);
    });

    test("a tent on a tree is reported and skips the other cell checks", () => {
        // Tent forced onto the tree at index 0 next to the correct tent at 1.
        const g = grid(["AA..", "....", "T.AT", "A..."]);
        const v = checkRules(d4, g);
        expect(v[0]).toEqual({ kind: "tent_on_tree", cell: 0 });
        expect(v.filter((x) => x.kind === "tents_touch")).toEqual([]);
        // The cell at 0 still counts as a tree, so it pairs with the tent at 1.
        expect(v.filter((x) => x.kind === "unmatched")).toEqual([]);
    });

    test("two tents touching orthogonally report one pair with a < b", () => {
        const v = checkRules(d4, grid(["TAA.", "....", "T.AT", "A..."]));
        expect(v.filter((x) => x.kind === "tents_touch")).toEqual([
            { kind: "tents_touch", a: 1, b: 2 },
        ]);
    });

    test("two tents touching diagonally report one pair", () => {
        // Tents at 1 and 4 (down-left).
        const v = checkRules(d4, grid(["TA..", "A...", "T.AT", "A..."]));
        expect(v.filter((x) => x.kind === "tents_touch")).toEqual([
            { kind: "tents_touch", a: 1, b: 4 },
        ]);
        // Tents at 1 and 6 (down-right); the tent at 10 is left out so 6 touches nothing else.
        const w = checkRules(d4, grid(["TA..", "..A.", "T..T", "A..."]));
        expect(w.filter((x) => x.kind === "tents_touch")).toEqual([
            { kind: "tents_touch", a: 1, b: 6 },
        ]);
    });

    test("vertical touch is reported from the upper tent", () => {
        const v = checkRules(d4, grid(["TA..", ".A..", "T..T", "A..."]));
        expect(v.filter((x) => x.kind === "tents_touch")).toEqual([
            { kind: "tents_touch", a: 1, b: 5 },
        ]);
    });

    test("a tent with no tree beside it", () => {
        const v = checkRules(d4, grid(["TA..", "....", "T.AT", "A.A."]));
        expect(v.filter((x) => x.kind === "tent_without_tree")).toEqual([
            { kind: "tent_without_tree", cell: 14 },
        ]);
        // A lone tent is not doubled up as an unmatched component.
        expect(v.filter((x) => x.kind === "unmatched")).toEqual([]);
    });

    test("row and column over- and under-counts", () => {
        // Extra tent at 13 (row 3, column 1): row 3 and column 1 are over.
        const over = checkRules(d4, grid(["TA..", "....", "T.AT", "AA.."]));
        expect(over.filter((x) => x.kind === "row_count" || x.kind === "column_count")).toEqual([
            { kind: "row_count", row: 3, expected: 1, actual: 2 },
            { kind: "column_count", column: 1, expected: 1, actual: 2 },
        ]);
        // Missing tent at 12: row 3 and column 0 are under.
        const under = checkRules(d4, grid(["TA..", "....", "T.AT", "...."]));
        expect(under.filter((x) => x.kind === "row_count" || x.kind === "column_count")).toEqual([
            { kind: "row_count", row: 3, expected: 1, actual: 0 },
            { kind: "column_count", column: 0, expected: 1, actual: 0 },
        ]);
    });

    test("one tent between two trees is a grid in progress, not a mistake", () => {
        // Row 0: T A T, one tent for two trees in one component; the second tent may still come.
        const d = desc(["T.T.", "....", "....", "...."], [1, 0, 0, 0], [0, 1, 0, 0]);
        expect(checkRules(d, grid([".A..", "....", "....", "...."]))).toEqual([]);
    });

    test("two tents on one tree leave the group unmatched", () => {
        // Row 0: A T A, two tents that can only pair with the same tree.
        const d = desc([".T..", "....", "....", "...."], [2, 0, 0, 0], [1, 0, 1, 0]);
        const v = checkRules(d, grid(["A.A.", "....", "....", "...."]));
        expect(v).toEqual([{ kind: "unmatched", trees: [1], tents: [0, 2] }]);
    });

    test("a tree with no tent beside a matched pair is not reported", () => {
        // Trees at 0 and 1 are not joined to each other; the tent at 4 pairs with 0 only.
        const d = desc(["TT..", "....", "....", "...."], [0, 1, 0, 0], [1, 0, 0, 0]);
        expect(checkRules(d, grid(["....", "A...", "....", "...."]))).toEqual([]);
    });

    test("components join through chains of trees and tents", () => {
        // T A T A in a row: two trees, two tents, one component, matched.
        const d = desc(["T.T.", "....", "....", "...."], [2, 0, 0, 0], [0, 1, 0, 1]);
        const v = checkRules(d, grid([".A.A", "....", "....", "...."]));
        expect(v).toEqual([]);
    });

    test("a grid of the wrong length counts as no tents", () => {
        expect(checkRules(d4, grid(["A"]))).toEqual(checkRules(d4, emptyGrid(d4)));
    });
});

describe("grid bytes", () => {
    test("round trip, grass becomes empty", () => {
        const g = grid(["TAxx", "xxxx", "TxAT", "Axxx"]);
        const bytes = toGridBytes(g);
        expect(bytes).toEqual(Uint8Array.from([0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0]));
        expect(fromGridBytes(bytes)).toEqual(solved4);
        expect(fromGridBytes([0, 2])).toEqual(["", "tent"]);
    });
});

describe("tents DailyGame", () => {
    test("id", () => {
        expect(tents.id).toBe("tents");
    });

    test("elements are one unlabelled cell per index", () => {
        const els = tents.elements(d5);
        expect(els).toHaveLength(25);
        expect(els[6]).toEqual({ key: 6, kind: "cell", x: 1, y: 1, w: 1, h: 1 });
        expect(els[24]).toEqual({ key: 24, kind: "cell", x: 4, y: 4, w: 1, h: 1 });
    });

    test("tap cycles empty cells and ignores trees", () => {
        const empty = tents.empty(d5);
        const a = tents.tap(d5, empty, 1);
        expect(a[1]).toBe("tent");
        expect(empty[1]).toBe("");
        const b = tents.tap(d5, a, 1);
        expect(b[1]).toBe("grass");
        expect(tents.tap(d5, b, 1)[1]).toBe("");
        expect(tents.tap(d5, empty, 2)).toBe(empty);
        expect(tents.tap(d5, empty, 99)).toBe(empty);
    });

    test("apply, filled and marks agree on the conclusion encoding", () => {
        let s = tents.empty(d5);
        s = tents.apply(d5, s, 1, 1);
        s = tents.apply(d5, s, 0, 0);
        s = tents.apply(d5, s, 2, 1);
        expect(tents.filled(d5, s)).toEqual([
            [0, 0],
            [1, 1],
        ]);
        expect(tents.marks(d5, s)).toEqual(
            new Map([
                [0, "grass"],
                [1, "tent"],
            ]),
        );
    });

    test("solved grid has no violations", () => {
        expect(tents.check(d5, solved5)).toEqual([]);
        expect(tents.solved(d5, solved5)).toBe(true);
        expect(tents.solved(d5, tents.empty(d5))).toBe(false);
    });

    test("under-counts are only reported once a line is fully marked", () => {
        const empty = tents.empty(d5);
        expect(tents.check(d5, empty).filter((v) => v.kind === "under")).toEqual([]);
        // Row 3 has count 0: all grass satisfies it. Row 1 has count 1: all grass is under.
        let s = empty;
        for (let x = 0; x < 5; x++) s = tents.apply(d5, s, 5 + x, 0);
        expect(tents.check(d5, s).filter((v) => v.kind === "under")).toEqual([
            { keys: [tentsRowKey(d5, 1)], kind: "under" },
        ]);
        // Column 4 fully marked as grass (its tree at 14 needs no mark): under too.
        for (const i of [4, 9, 19, 24]) s = tents.apply(d5, s, i, 0);
        expect(tents.check(d5, s).filter((v) => v.kind === "under")).toEqual([
            { keys: [tentsRowKey(d5, 1)], kind: "under" },
            { keys: [tentsColumnKey(d5, 4)], kind: "under" },
        ]);
        expect(tents.solved(d5, s)).toBe(false);
    });

    test("check maps rule violations onto keys", () => {
        // solved5 plus a tent at 5 (touches 1 and 11 diagonally, shares tree 10 with 11) and a
        // lonely tent at 18. Rows 1 and 3 and columns 0 and 3 go over; nothing is fully marked.
        const g = grid([".AT..", "A...A", "TA..T", "...A.", "AT..."]);
        const v = tents.check(d5, g);
        expect(v.filter((x) => x.kind === "clash")).toEqual([
            { keys: [1, 5], kind: "clash" },
            { keys: [5, 11], kind: "clash" },
        ]);
        expect(v.filter((x) => x.kind === "lonely")).toEqual([{ keys: [18], kind: "lonely" }]);
        expect(v.filter((x) => x.kind === "over")).toEqual([
            { keys: [tentsRowKey(d5, 1)], kind: "over" },
            { keys: [tentsRowKey(d5, 3)], kind: "over" },
            { keys: [tentsColumnKey(d5, 0)], kind: "over" },
            { keys: [tentsColumnKey(d5, 3)], kind: "over" },
        ]);
        expect(v.filter((x) => x.kind === "under")).toEqual([]);
        expect(v.filter((x) => x.kind === "unmatched")).toEqual([
            { keys: [10, 5, 11], kind: "unmatched" },
        ]);
        expect(tents.solved(d5, g)).toBe(false);
    });

    test("a tent on a tree and an unmatched group map to clash and unmatched", () => {
        // apply refuses trees, so force the tent through fromBytes.
        expect(tents.apply(d5, solved5, 2, 1)).toBe(solved5);
        const bytes = tents.toBytes(d5, solved5);
        bytes[2] = 1;
        const forced = tents.fromBytes(d5, bytes)!;
        expect(tents.check(d5, forced).filter((x) => x.kind === "clash")).toEqual([
            { keys: [2], kind: "clash" },
        ]);
        const d = desc([".T..", "....", "....", "...."], [2, 0, 0, 0], [1, 0, 1, 0]);
        expect(tents.check(d, grid(["A.A.", "....", "....", "...."]))).toEqual([
            { keys: [1, 0, 2], kind: "unmatched" },
        ]);
    });

    test("bytes round trip and reject the wrong length", () => {
        const bytes = tents.toBytes(d5, solved5);
        expect(tents.fromBytes(d5, bytes)).toEqual(solved5);
        expect(tents.fromBytes(d5, bytes.slice(1))).toBeUndefined();
        expect(tents.fromBytes(d5, bytes)).not.toBe(solved5);
    });

    test("lit is not provided", () => {
        expect(tents.lit).toBeUndefined();
    });
});
