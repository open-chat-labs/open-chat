import { describe, expect, test } from "vitest";
import {
    checkRules,
    cycleCell,
    emptyGrid,
    fromGridBytes,
    isGiven,
    isSolved,
    parseDescription,
    toGridBytes,
    unruly,
    unrulyColumnTarget,
    unrulyGrid,
    unrulyRowTarget,
    type UnrulyCell,
    type UnrulyDescription,
} from "./unruly";

// Rows of width characters: '.' blank, '1' the first value, '2' the second.
function cells(rows: string[]): UnrulyCell[] {
    return rows
        .join("")
        .split("")
        .map((ch) => (ch === "1" ? 1 : ch === "2" ? 2 : 0));
}

function descBytes(rows: string[]): number[] {
    return [1, rows[0].length, rows.length, ...cells(rows)];
}

function desc(rows: string[]): UnrulyDescription {
    return parseDescription(descBytes(rows));
}

const blank6 = desc(["......", "......", "......", "......", "......", "......"]);

// A 4x4 whose only answer is `answer4`.
const puzzle4 = desc(["1...", "..1.", ".2..", "...1"]);
const answer4 = cells(["1122", "2211", "1212", "2121"]);
// The same answer as the player's marks: the givens' slots stay empty.
const marks4 = cells([".122", "22.1", "1.12", "212."]);

describe("parseDescription", () => {
    test("round-trips a 4x4", () => {
        const d = desc(["1...", "..2.", "....", "...1"]);
        expect(d.width).toBe(4);
        expect(d.height).toBe(4);
        expect(d.givens).toHaveLength(16);
        expect(d.givens[0]).toBe(1);
        expect(d.givens[6]).toBe(2);
        expect(d.givens[15]).toBe(1);
        expect(d.givens[1]).toBe(0);
        expect(
            parseDescription(new Uint8Array(descBytes(["1...", "..2.", "....", "...1"]))),
        ).toEqual(d);
    });

    test("rejects the wrong version", () => {
        const bytes = descBytes(["....", "....", "....", "...."]);
        bytes[0] = 2;
        expect(() => parseDescription(bytes)).toThrow("malformed unruly description");
    });

    test("rejects the wrong length", () => {
        const bytes = descBytes(["....", "....", "....", "...."]);
        expect(() => parseDescription(bytes.slice(0, -1))).toThrow("malformed unruly description");
        expect(() => parseDescription([...bytes, 0])).toThrow("malformed unruly description");
        expect(() => parseDescription([1, 4])).toThrow("malformed unruly description");
    });

    test("rejects odd or tiny sides", () => {
        expect(() => parseDescription([1, 3, 2, 0, 0, 0, 0, 0, 0])).toThrow(
            "malformed unruly description",
        );
        expect(() => parseDescription([1, 2, 3, 0, 0, 0, 0, 0, 0])).toThrow(
            "malformed unruly description",
        );
        expect(() => parseDescription([1, 0, 2])).toThrow("malformed unruly description");
    });

    test("rejects a given byte that is neither value", () => {
        const bytes = descBytes(["....", "....", "....", "...."]);
        bytes[5] = 3;
        expect(() => parseDescription(bytes)).toThrow("malformed unruly description");
    });
});

describe("cycleCell", () => {
    test("empty -> first -> second -> empty", () => {
        expect(cycleCell(0)).toBe(1);
        expect(cycleCell(1)).toBe(2);
        expect(cycleCell(2)).toBe(0);
    });
});

describe("unrulyGrid", () => {
    test("lays the marks over the givens", () => {
        expect(unrulyGrid(puzzle4, marks4)).toEqual(answer4);
        expect(unrulyGrid(puzzle4, emptyGrid(puzzle4))).toEqual(puzzle4.givens);
    });

    test("a state of the wrong length leaves only the givens", () => {
        expect(unrulyGrid(puzzle4, [1, 2])).toEqual(puzzle4.givens);
    });

    test("line targets are half the side", () => {
        expect(unrulyRowTarget(blank6)).toBe(3);
        expect(unrulyColumnTarget(blank6)).toBe(3);
    });
});

describe("checkRules", () => {
    test("empty grid is incomplete, not wrong", () => {
        expect(checkRules(blank6, emptyGrid(blank6))).toEqual([]);
        expect(isSolved(blank6, emptyGrid(blank6))).toBe(false);
    });

    test("solved grid has no violations", () => {
        expect(checkRules(puzzle4, answer4)).toEqual([]);
        expect(isSolved(puzzle4, answer4)).toBe(true);
    });

    test("one empty cell is not solved", () => {
        const g = [...answer4];
        g[5] = 0;
        expect(checkRules(puzzle4, g)).toEqual([]);
        expect(isSolved(puzzle4, g)).toBe(false);
    });

    test("three the same across a row", () => {
        expect(
            checkRules(blank6, cells(["111...", "......", "......", "......", "......", "......"])),
        ).toEqual([{ kind: "run", cells: [0, 1, 2], value: 1 }]);
    });

    test("three the same down a column", () => {
        expect(
            checkRules(blank6, cells(["2.....", "2.....", "2.....", "......", "......", "......"])),
        ).toEqual([{ kind: "run", cells: [0, 6, 12], value: 2 }]);
    });

    test("four the same across a row is two runs and a row count", () => {
        expect(
            checkRules(blank6, cells(["1111..", "......", "......", "......", "......", "......"])),
        ).toEqual([
            { kind: "run", cells: [0, 1, 2], value: 1 },
            { kind: "run", cells: [1, 2, 3], value: 1 },
            { kind: "row_count", row: 0, value: 1, count: 4, cells: [0, 1, 2, 3] },
        ]);
    });

    test("a row with too many of one value, with no run", () => {
        expect(
            checkRules(blank6, cells(["11.11.", "......", "......", "......", "......", "......"])),
        ).toEqual([{ kind: "row_count", row: 0, value: 1, count: 4, cells: [0, 1, 3, 4] }]);
    });

    test("a column with too many of one value, with no run", () => {
        expect(
            checkRules(blank6, cells(["2.....", "2.....", "......", "2.....", "2.....", "......"])),
        ).toEqual([{ kind: "column_count", column: 0, value: 2, count: 4, cells: [0, 6, 18, 24] }]);
    });

    // The crate only complains once a line holds MORE of a value than it is allowed, which no
    // amount of further filling can undo. A line that merely has all of one value it is going
    // to get, or none of the other yet, is still on course.
    test("a line at its quota is not a violation", () => {
        expect(
            checkRules(blank6, cells(["11.1..", "......", "......", "......", "......", "......"])),
        ).toEqual([]);
        expect(
            checkRules(blank6, cells(["1.....", "1.....", "..1...", "1.....", "......", "......"])),
        ).toEqual([]);
    });

    test("a line short of a value is not a violation", () => {
        expect(
            checkRules(blank6, cells(["222...", "......", "......", "......", "......", "......"])),
        ).toEqual([{ kind: "run", cells: [0, 1, 2], value: 2 }]);
        expect(
            checkRules(blank6, cells(["2.2.2.", "......", "......", "......", "......", "......"])),
        ).toEqual([]);
    });

    test("a grid of the wrong length counts as empty", () => {
        expect(checkRules(puzzle4, [1, 2])).toEqual([]);
        expect(isSolved(puzzle4, [1, 2])).toBe(false);
    });
});

describe("grid bytes", () => {
    test("round trip drops the givens back out of the state", () => {
        const bytes = toGridBytes(unrulyGrid(puzzle4, marks4));
        expect(bytes).toEqual(Uint8Array.from(answer4));
        expect(fromGridBytes(puzzle4, bytes)).toEqual(marks4);
        expect(fromGridBytes(puzzle4, [0, 1, 2, 3, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])).toEqual(
            cells([".12.", "....", "....", "...."]),
        );
    });
});

describe("unruly DailyGame", () => {
    test("elements are the cells, givens included", () => {
        const els = unruly.elements(puzzle4);
        expect(els).toHaveLength(16);
        expect(els[0]).toEqual({ key: 0, kind: "cell", x: 0, y: 0, w: 1, h: 1 });
        expect(els[6]).toEqual({ key: 6, kind: "cell", x: 2, y: 1, w: 1, h: 1 });
        expect(els[15]).toEqual({ key: 15, kind: "cell", x: 3, y: 3, w: 1, h: 1 });
    });

    test("tap cycles an empty cell and never touches a given", () => {
        const empty = unruly.empty(puzzle4);
        const a = unruly.tap(puzzle4, empty, 1);
        expect(a[1]).toBe(1);
        expect(empty[1]).toBe(0);
        const b = unruly.tap(puzzle4, a, 1);
        expect(b[1]).toBe(2);
        expect(unruly.tap(puzzle4, b, 1)[1]).toBe(0);
        // 0, 6, 9 and 15 are the givens; they are returned unchanged, and stay their own value.
        expect(isGiven(puzzle4, 0)).toBe(true);
        expect(unruly.tap(puzzle4, empty, 0)).toBe(empty);
        expect(unruly.tap(puzzle4, empty, 6)).toBe(empty);
        expect(unruly.tap(puzzle4, empty, 9)).toBe(empty);
        expect(unruly.tap(puzzle4, empty, 15)).toBe(empty);
        expect(unrulyGrid(puzzle4, unruly.tap(puzzle4, empty, 0))[0]).toBe(1);
        expect(unruly.tap(puzzle4, empty, -1)).toBe(empty);
        expect(unruly.tap(puzzle4, empty, 16)).toBe(empty);
    });

    test("apply takes the two values only, and never a given", () => {
        let s = unruly.empty(puzzle4);
        s = unruly.apply(puzzle4, s, 1, 1);
        s = unruly.apply(puzzle4, s, 2, 2);
        expect(unruly.apply(puzzle4, s, 3, 0)).toBe(s);
        expect(unruly.apply(puzzle4, s, 0, 2)).toBe(s);
        expect(unruly.apply(puzzle4, s, 16, 1)).toBe(s);
        expect(unruly.filled(puzzle4, s)).toEqual([
            [1, 1],
            [2, 2],
        ]);
    });

    test("marks name the givens apart from the player's own cells", () => {
        let s = unruly.empty(puzzle4);
        s = unruly.apply(puzzle4, s, 1, 1);
        s = unruly.apply(puzzle4, s, 2, 2);
        expect(unruly.marks(puzzle4, s)).toEqual(
            new Map([
                [0, "given_a"],
                [1, "a"],
                [2, "b"],
                [6, "given_a"],
                [9, "given_b"],
                [15, "given_a"],
            ]),
        );
    });

    test("check paints runs and over-full lines on their cells", () => {
        expect(unruly.check(puzzle4, marks4)).toEqual([]);
        expect(unruly.solved(puzzle4, marks4)).toBe(true);
        // The top row is 1 1 2 2; make the third cell a 1 as well. That is three across the top
        // and, with the 1s below it, three down the third column too.
        const wrong = unruly.apply(puzzle4, marks4, 2, 1);
        expect(unruly.check(puzzle4, wrong)).toEqual([
            { keys: [0, 1, 2], kind: "run" },
            { keys: [2, 6, 10], kind: "run" },
            { keys: [0, 1, 2], kind: "row_count" },
            { keys: [2, 6, 10], kind: "column_count" },
        ]);
        expect(unruly.solved(puzzle4, wrong)).toBe(false);
    });

    test("bytes carry the givens and round trip", () => {
        const bytes = unruly.toBytes(puzzle4, marks4);
        expect(bytes).toEqual(Uint8Array.from(answer4));
        expect(unruly.fromBytes(puzzle4, bytes)).toEqual(marks4);
        expect(unruly.fromBytes(puzzle4, bytes.slice(1))).toBeUndefined();
    });

    test("has no derived highlight", () => {
        expect(unruly.lit).toBeUndefined();
    });
});
