import { describe, expect, test } from "vitest";
import {
    checkRules,
    computeLighting,
    cycleCell,
    emptyGrid,
    fromGridBytes,
    isSolved,
    lightUp,
    neighbours,
    parseDescription,
    toGridBytes,
    type LightUpCell,
    type LightUpDescription,
} from "./lightUp";

// '.' white, '#' black unnumbered, '0'-'4' black with clue.
function descBytes(rows: string[]): number[] {
    const bytes = [1, rows[0].length, rows.length];
    for (const row of rows) {
        for (const ch of row) {
            bytes.push(ch === "." ? 0x00 : ch === "#" ? 0x10 : 0x11 + Number(ch));
        }
    }
    return bytes;
}

function desc(rows: string[]): LightUpDescription {
    return parseDescription(descBytes(rows));
}

// 'B' bulb, 'x' dot, '.' empty.
function grid(rows: string[]): LightUpCell[] {
    return rows
        .join("")
        .split("")
        .map((ch) => (ch === "B" ? "bulb" : ch === "x" ? "dot" : "empty"));
}

// '*' lit, '.' not lit.
function lit(rows: string[]): boolean[] {
    return rows
        .join("")
        .split("")
        .map((ch) => ch === "*");
}

const allWhite3 = desc(["...", "...", "..."]);

describe("parseDescription", () => {
    test("round-trips a 3x3", () => {
        const d = desc(["..#", ".1.", "0.4"]);
        expect(d.width).toBe(3);
        expect(d.height).toBe(3);
        expect(d.cells).toEqual([
            { kind: "white" },
            { kind: "white" },
            { kind: "black" },
            { kind: "white" },
            { kind: "black", clue: 1 },
            { kind: "white" },
            { kind: "black", clue: 0 },
            { kind: "white" },
            { kind: "black", clue: 4 },
        ]);
        expect(parseDescription(new Uint8Array(descBytes(["..#", ".1.", "0.4"])))).toEqual(d);
    });

    test("rejects the wrong version", () => {
        const bytes = descBytes(["...", "...", "..."]);
        bytes[0] = 2;
        expect(() => parseDescription(bytes)).toThrow("malformed light up description");
    });

    test("rejects a short buffer", () => {
        const bytes = descBytes(["...", "...", "..."]);
        expect(() => parseDescription(bytes.slice(0, -1))).toThrow("malformed light up description");
        expect(() => parseDescription([1, 3])).toThrow("malformed light up description");
    });

    test("rejects an unknown cell byte", () => {
        const bytes = descBytes(["...", "...", "..."]);
        bytes[5] = 0x16;
        expect(() => parseDescription(bytes)).toThrow("malformed light up description");
        bytes[5] = 0x01;
        expect(() => parseDescription(bytes)).toThrow("malformed light up description");
    });
});

describe("neighbours", () => {
    test("returns in-bounds cells in left, right, up, down order", () => {
        expect(neighbours(allWhite3, 4)).toEqual([3, 5, 1, 7]);
        expect(neighbours(allWhite3, 0)).toEqual([1, 3]);
        expect(neighbours(allWhite3, 8)).toEqual([7, 5]);
    });
});

describe("checkRules 3x3", () => {
    // A 3x3 with a centre 1 has no solution (any bulb next to the clue leaves a corner
    // column unlightable), so the solved case uses a centre 2.
    const centre2 = desc(["...", ".2.", "..."]);
    const centre1 = desc(["...", ".1.", "..."]);

    test("solved grid has no violations", () => {
        const g = grid([".B.", "B..", "..B"]);
        expect(checkRules(centre2, g)).toEqual([]);
        expect(isSolved(centre2, g)).toBe(true);
        expect(isSolved(centre2, emptyGrid(centre2))).toBe(false);
    });

    test("dots count as no bulb", () => {
        const g = grid([".B.", "Bxx", "xxB"]);
        expect(checkRules(centre2, g)).toEqual([]);
    });

    test("two bulbs on one row report one pair with a < b", () => {
        expect(checkRules(allWhite3, grid(["B.B", "...", "..."]))).toEqual([
            { kind: "bulb_sees_bulb", a: 0, b: 2 },
            { kind: "unlit", cell: 4 },
            { kind: "unlit", cell: 7 },
        ]);
    });

    test("a black cell between two bulbs blocks the line", () => {
        expect(checkRules(desc([".#.", "...", "..."]), grid(["B.B", "...", "..."]))).toEqual([
            { kind: "unlit", cell: 4 },
            { kind: "unlit", cell: 7 },
        ]);
    });

    test("two bulbs on one column report one pair", () => {
        const v = checkRules(allWhite3, grid(["B..", "...", "B.."]));
        expect(v.filter((x) => x.kind === "bulb_sees_bulb")).toEqual([
            { kind: "bulb_sees_bulb", a: 0, b: 6 },
        ]);
    });

    test("clue count over", () => {
        const v = checkRules(centre1, grid([".B.", "B..", "..B"]));
        expect(v.filter((x) => x.kind === "clue_count")).toEqual([
            { kind: "clue_count", clue: 4, expected: 1, actual: 2 },
        ]);
    });

    test("clue count under", () => {
        const v = checkRules(centre1, grid(["B..", "...", "..B"]));
        expect(v).toEqual([{ kind: "clue_count", clue: 4, expected: 1, actual: 0 }]);
    });

    test("unlit cells are listed in index order", () => {
        expect(checkRules(allWhite3, grid(["...", ".B.", "..."]))).toEqual([
            { kind: "unlit", cell: 0 },
            { kind: "unlit", cell: 2 },
            { kind: "unlit", cell: 6 },
            { kind: "unlit", cell: 8 },
        ]);
    });

    test("a bulb on a black cell is reported and lights nothing", () => {
        const d = desc([".#.", "...", "..."]);
        const g = grid([".B.", "...", "..."]);
        expect(computeLighting(d, g)).toEqual(lit(["...", "...", "..."]));
        expect(checkRules(d, g)).toEqual([
            { kind: "bulb_on_black", cell: 1 },
            { kind: "unlit", cell: 0 },
            { kind: "unlit", cell: 2 },
            { kind: "unlit", cell: 3 },
            { kind: "unlit", cell: 4 },
            { kind: "unlit", cell: 5 },
            { kind: "unlit", cell: 6 },
            { kind: "unlit", cell: 7 },
            { kind: "unlit", cell: 8 },
        ]);
    });

    test("a grid of the wrong length counts as no bulbs", () => {
        expect(checkRules(centre1, grid(["B", "B"]))).toEqual([
            { kind: "unlit", cell: 0 },
            { kind: "unlit", cell: 1 },
            { kind: "unlit", cell: 2 },
            { kind: "unlit", cell: 3 },
            { kind: "clue_count", clue: 4, expected: 1, actual: 0 },
            { kind: "unlit", cell: 5 },
            { kind: "unlit", cell: 6 },
            { kind: "unlit", cell: 7 },
            { kind: "unlit", cell: 8 },
        ]);
    });

    test("bulb pairs are reported before unlit cells regardless of index", () => {
        expect(checkRules(allWhite3, grid(["...", "...", "B.B"]))).toEqual([
            { kind: "bulb_sees_bulb", a: 6, b: 8 },
            { kind: "unlit", cell: 1 },
            { kind: "unlit", cell: 4 },
        ]);
    });
});

describe("checkRules 5x5", () => {
    const d = desc([".....", ".0.#.", ".....", ".2...", "....."]);
    const solved = grid(["B....", "....B", "...B.", "..B..", ".B..."]);

    test("solved grid", () => {
        expect(checkRules(d, solved)).toEqual([]);
        expect(isSolved(d, solved)).toBe(true);
    });

    test("one bulb short", () => {
        const g = grid(["B....", "....B", "...B.", ".....", ".B..."]);
        expect(checkRules(d, g)).toEqual([
            { kind: "unlit", cell: 7 },
            { kind: "clue_count", clue: 16, expected: 2, actual: 1 },
            { kind: "unlit", cell: 17 },
        ]);
        expect(isSolved(d, g)).toBe(false);
    });

    test("computeLighting", () => {
        expect(computeLighting(d, solved)).toEqual(
            lit(["*****", "*.*.*", "*****", "*.***", "*****"]),
        );
        expect(computeLighting(d, grid(["B....", "....B", "...B.", ".....", ".B..."]))).toEqual(
            lit(["*****", "*...*", "*****", "*..**", "*****"]),
        );
    });
});

describe("grid bytes", () => {
    test("round trip, dots become empty", () => {
        const g = grid([".B.", "Bxx", "xxB"]);
        const bytes = toGridBytes(g);
        expect(bytes).toEqual(Uint8Array.from([0, 1, 0, 1, 0, 0, 0, 0, 1]));
        expect(fromGridBytes(bytes)).toEqual(grid([".B.", "B..", "..B"]));
        expect(fromGridBytes([0, 2])).toEqual(["empty", "bulb"]);
    });
});

describe("cycleCell", () => {
    test("empty -> bulb -> dot -> empty", () => {
        expect(cycleCell("empty")).toBe("bulb");
        expect(cycleCell("bulb")).toBe("dot");
        expect(cycleCell("dot")).toBe("empty");
    });
});

describe("lightUp DailyGame", () => {
    const d = desc([".....", ".0.#.", ".....", ".2...", "....."]);
    const solved = grid(["B....", "....B", "...B.", "..B..", ".B..."]);

    test("elements are one cell per index with clue labels", () => {
        const els = lightUp.elements(d);
        expect(els).toHaveLength(25);
        expect(els[6]).toEqual({ key: 6, kind: "cell", x: 1, y: 1, w: 1, h: 1, label: "0" });
        expect(els[8]).toEqual({ key: 8, kind: "cell", x: 3, y: 1, w: 1, h: 1, label: undefined });
        expect(els[16].label).toBe("2");
    });

    test("tap cycles white cells and ignores black ones", () => {
        const empty = lightUp.empty(d);
        const a = lightUp.tap(d, empty, 0);
        expect(a[0]).toBe("bulb");
        expect(empty[0]).toBe("empty");
        expect(lightUp.tap(d, a, 0)[0]).toBe("dot");
        expect(lightUp.tap(d, empty, 6)).toBe(empty);
    });

    test("apply, filled and marks agree on the conclusion encoding", () => {
        let s = lightUp.empty(d);
        s = lightUp.apply(d, s, 0, 1);
        s = lightUp.apply(d, s, 1, 0);
        s = lightUp.apply(d, s, 6, 1);
        expect(lightUp.filled(d, s)).toEqual([
            [0, 1],
            [1, 0],
        ]);
        expect(lightUp.marks(d, s)).toEqual(
            new Map([
                [0, "bulb"],
                [1, "dot"],
            ]),
        );
    });

    test("check maps rule violations onto keys", () => {
        expect(lightUp.check(d, solved)).toEqual([]);
        expect(lightUp.solved(d, solved)).toBe(true);
        const v = lightUp.check(d, grid(["B.B..", ".....", ".....", ".....", "....."]));
        expect(v[0]).toEqual({ keys: [0, 2], kind: "clash" });
        expect(v.find((x) => x.kind === "under")).toEqual({ keys: [16], kind: "under" });
        expect(v.filter((x) => x.kind === "unlit").length).toBeGreaterThan(0);
    });

    test("bytes round trip and reject the wrong length", () => {
        const bytes = lightUp.toBytes(d, solved);
        expect(lightUp.fromBytes(d, bytes)).toEqual(solved);
        expect(lightUp.fromBytes(d, bytes.slice(1))).toBeUndefined();
    });

    test("lit is the set of lit indices", () => {
        const lit = lightUp.lit!(d, grid(["B....", ".....", ".....", ".....", "....."]));
        expect([...lit].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 10, 15, 20]);
    });
});
