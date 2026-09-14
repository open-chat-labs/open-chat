import { describe, expect, test } from "vitest";
import {
    bridges,
    bridgesHitShapes,
    bridgesMistakeElements,
    bridgesIslandTotals,
    checkRules,
    emptyState,
    fromGridBytes,
    isSolved,
    parseDescription,
    toGridBytes,
    type BridgesDescription,
    type BridgesState,
} from "./bridges";

// '.' water, '1'-'8' island.
function descBytes(rows: string[]): number[] {
    const bytes = [1, rows[0].length, rows.length];
    for (const row of rows) {
        for (const ch of row) {
            bytes.push(ch === "." ? 0 : Number(ch));
        }
    }
    return bytes;
}

function desc(rows: string[]): BridgesDescription {
    return parseDescription(descBytes(rows));
}

function state(entries: [number, number][]): BridgesState {
    return new Map(entries);
}

// Islands at 0, 2, 6, 8. Edges: 0 (0-2), 1 (0-6), 5 (2-8), 12 (6-8).
const square = desc(["2.2", "...", "2.2"]);
// Islands at 1, 3, 5, 7. Edges 3 (1-7) and 6 (3-5) cross at cell 4.
const cross = desc([".1.", "1.1", ".1."]);
// Islands at 0, 3, 12, 15. Edges 0 (0-3), 1 (0-12), 7 (3-15), 24 (12-15).
const four = desc(["2..2", "....", "....", "2..2"]);
// Solution: 0-2 double, 0-6 single, 2-8 single, 6-8 none.
const doubles = desc(["3.3", "...", "1.1"]);

describe("parseDescription", () => {
    test("derives the edges in island order, right then down", () => {
        expect(square.width).toBe(3);
        expect(square.height).toBe(3);
        expect(square.cells).toEqual([2, 0, 2, 0, 0, 0, 2, 0, 2]);
        expect(square.edges).toEqual([
            { key: 0, a: 0, b: 2, horizontal: true, cells: [1], crossings: [] },
            { key: 1, a: 0, b: 6, horizontal: false, cells: [3], crossings: [] },
            { key: 5, a: 2, b: 8, horizontal: false, cells: [5], crossings: [] },
            { key: 12, a: 6, b: 8, horizontal: true, cells: [7], crossings: [] },
        ]);
        expect(parseDescription(new Uint8Array(descBytes(["2.2", "...", "2.2"])))).toEqual(square);
    });

    test("edges span several water cells and record crossings", () => {
        expect(four.edges.map((e) => [e.key, e.cells])).toEqual([
            [0, [1, 2]],
            [1, [4, 8]],
            [7, [7, 11]],
            [24, [13, 14]],
        ]);
        expect(cross.edges).toEqual([
            { key: 3, a: 1, b: 7, horizontal: false, cells: [4], crossings: [6] },
            { key: 6, a: 3, b: 5, horizontal: true, cells: [4], crossings: [3] },
        ]);
    });

    test("an island in the way ends the edge", () => {
        const d = desc(["1.2.1", ".....", "....."]);
        expect(d.edges.map((e) => [e.key, e.a, e.b])).toEqual([
            [0, 0, 2],
            [4, 2, 4],
        ]);
    });

    test("rejects bad input", () => {
        const bytes = descBytes(["2.2", "...", "2.2"]);
        expect(() => parseDescription([2, ...bytes.slice(1)])).toThrow(
            "malformed bridges description",
        );
        expect(() => parseDescription(bytes.slice(0, -1))).toThrow("malformed bridges description");
        expect(() => parseDescription([1, 3])).toThrow("malformed bridges description");
        expect(() => parseDescription([...bytes.slice(0, 3), 9, ...bytes.slice(4)])).toThrow(
            "malformed bridges description",
        );
        expect(() => desc(["11.", "...", "..1"])).toThrow("malformed bridges description");
        expect(() => desc(["1..", "1..", "..1"])).toThrow("malformed bridges description");
        expect(() => desc(["1..", "...", "..."])).toThrow("malformed bridges description");
    });
});

describe("checkRules", () => {
    test("empty state is short on every island", () => {
        expect(checkRules(square, emptyState())).toEqual([
            { kind: "island_count", cell: 0, expected: 2, actual: 0 },
            { kind: "island_count", cell: 2, expected: 2, actual: 0 },
            { kind: "island_count", cell: 6, expected: 2, actual: 0 },
            { kind: "island_count", cell: 8, expected: 2, actual: 0 },
        ]);
    });

    test("crossing bridges are reported as (horizontal, vertical)", () => {
        const s = state([
            [3, 1],
            [6, 1],
        ]);
        expect(checkRules(cross, s)).toEqual([
            { kind: "crossing", horizontal: 6, vertical: 3 },
            { kind: "disconnected", islands: [3, 5] },
        ]);
        expect(isSolved(cross, s)).toBe(false);
    });

    test("an island with too many bridges", () => {
        const s = state([
            [0, 2],
            [1, 1],
        ]);
        expect(checkRules(square, s)).toEqual([
            { kind: "island_count", cell: 0, expected: 2, actual: 3 },
            { kind: "island_count", cell: 6, expected: 2, actual: 1 },
            { kind: "island_count", cell: 8, expected: 2, actual: 0 },
        ]);
    });

    test("disconnected only once every island is satisfied", () => {
        const twoPairs = state([
            [0, 2],
            [12, 2],
        ]);
        expect(checkRules(square, twoPairs)).toEqual([{ kind: "disconnected", islands: [6, 8] }]);
        expect(isSolved(square, twoPairs)).toBe(false);
        const onePair = state([[0, 2]]);
        expect(checkRules(square, onePair).every((v) => v.kind === "island_count")).toBe(true);
    });

    test("solved layouts", () => {
        const ring = state([
            [0, 1],
            [1, 1],
            [5, 1],
            [12, 1],
        ]);
        expect(checkRules(square, ring)).toEqual([]);
        expect(isSolved(square, ring)).toBe(true);
        expect(
            isSolved(
                doubles,
                state([
                    [0, 2],
                    [1, 1],
                    [5, 1],
                    [12, 0],
                ]),
            ),
        ).toBe(true);
        expect(
            isSolved(
                four,
                state([
                    [0, 1],
                    [1, 1],
                    [7, 1],
                    [24, 1],
                ]),
            ),
        ).toBe(true);
    });

    test("island totals", () => {
        expect(
            bridgesIslandTotals(
                doubles,
                state([
                    [0, 2],
                    [1, 1],
                ]),
            ),
        ).toEqual(
            new Map([
                [0, 3],
                [2, 2],
                [6, 1],
                [8, 0],
            ]),
        );
    });
});

describe("grid bytes", () => {
    test("round trip with single, double and vertical bridges", () => {
        const s = state([
            [0, 2],
            [1, 1],
            [5, 1],
        ]);
        const bytes = toGridBytes(doubles, s);
        expect(bytes).toEqual(Uint8Array.from([0, 2, 0, 3, 0, 3, 0, 0, 0]));
        expect(fromGridBytes(doubles, bytes)).toEqual(s);

        const long = state([
            [0, 1],
            [1, 2],
            [7, 1],
            [24, 1],
        ]);
        const longBytes = toGridBytes(four, long);
        expect(longBytes).toEqual(
            Uint8Array.from([0, 1, 1, 0, 4, 0, 0, 3, 4, 0, 0, 3, 0, 1, 1, 0]),
        );
        expect(fromGridBytes(four, longBytes)).toEqual(long);
    });

    test("committed zeros are not in the bytes", () => {
        const s = state([[12, 0]]);
        expect(toGridBytes(doubles, s)).toEqual(new Uint8Array(9));
        expect(fromGridBytes(doubles, toGridBytes(doubles, s))).toEqual(emptyState());
    });

    test("rejects the wrong length and bad layouts", () => {
        expect(fromGridBytes(four, new Uint8Array(15))).toBeUndefined();
        const bad = (cell: number, byte: number) => {
            const bytes = new Uint8Array(16);
            bytes[cell] = byte;
            return fromGridBytes(four, bytes);
        };
        // byte above 4
        expect(bad(1, 5)).toBeUndefined();
        // bridge on an island
        expect(bad(0, 1)).toBeUndefined();
        // vertical bridge on horizontal-only water
        expect(bad(1, 3)).toBeUndefined();
        // bridge on water no edge crosses
        expect(bad(5, 1)).toBeUndefined();
        // an edge whose cells disagree
        expect(bad(1, 1)).toBeUndefined();
        expect(
            fromGridBytes(four, [0, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
        ).toBeUndefined();
    });

    test("a crossed cell reads as the orientation its byte names", () => {
        expect(fromGridBytes(cross, [0, 0, 0, 0, 1, 0, 0, 0, 0])).toEqual(state([[6, 1]]));
        expect(fromGridBytes(cross, [0, 0, 0, 0, 4, 0, 0, 0, 0])).toEqual(state([[3, 2]]));
    });
});

describe("bridges DailyGame", () => {
    // #9334 invariant 55. Island 0 and edge 0 both exist on this board; a mistake key is an edge.
    test("a mistake key is drawn on the edge, not the island with the same index", () => {
        const els = bridges.elements(four);
        expect(bridgesMistakeElements(els, [0])).toEqual([
            { key: 0, kind: "edge", x: 1, y: 0, w: 2, h: 1 },
        ]);
        expect(bridgesMistakeElements(els, [99])).toEqual([]);
    });

    test("elements are islands with labels and edges spanning the water", () => {
        const els = bridges.elements(four);
        expect(els.filter((el) => el.kind === "cell")).toEqual([
            { key: 0, kind: "cell", x: 0, y: 0, w: 1, h: 1, label: "2" },
            { key: 3, kind: "cell", x: 3, y: 0, w: 1, h: 1, label: "2" },
            { key: 12, kind: "cell", x: 0, y: 3, w: 1, h: 1, label: "2" },
            { key: 15, kind: "cell", x: 3, y: 3, w: 1, h: 1, label: "2" },
        ]);
        expect(els.filter((el) => el.kind === "edge")).toEqual([
            { key: 0, kind: "edge", x: 1, y: 0, w: 2, h: 1 },
            { key: 1, kind: "edge", x: 0, y: 1, w: 1, h: 2 },
            { key: 7, kind: "edge", x: 3, y: 1, w: 1, h: 2 },
            { key: 24, kind: "edge", x: 1, y: 3, w: 2, h: 1 },
        ]);
    });

    test("tap cycles 0 -> 1 -> 2 -> 0 and keeps the zero as committed", () => {
        const empty = bridges.empty(square);
        const one = bridges.tap(square, empty, 0);
        expect(one).toEqual(state([[0, 1]]));
        expect(empty.size).toBe(0);
        const two = bridges.tap(square, one, 0);
        expect(two).toEqual(state([[0, 2]]));
        const back = bridges.tap(square, two, 0);
        expect(back).toEqual(state([[0, 0]]));
        expect(bridges.filled(square, back)).toEqual([[0, 0]]);
        expect(bridges.marks(square, back)).toEqual(new Map([[0, "none"]]));
    });

    test("tap and apply ignore keys that are not edges", () => {
        const empty = bridges.empty(square);
        // 2 is an island cell index but no edge has key 2
        expect(bridges.tap(square, empty, 2)).toBe(empty);
        expect(bridges.apply(square, empty, 2, 1)).toBe(empty);
        expect(bridges.apply(square, empty, 0, 3)).toBe(empty);
    });

    test("apply, filled and marks agree on the conclusion encoding", () => {
        let s = bridges.empty(doubles);
        s = bridges.apply(doubles, s, 0, 2);
        s = bridges.apply(doubles, s, 12, 0);
        s = bridges.apply(doubles, s, 1, 1);
        expect(bridges.filled(doubles, s)).toEqual([
            [0, 2],
            [12, 0],
            [1, 1],
        ]);
        expect(bridges.marks(doubles, s)).toEqual(
            new Map([
                [0, "two"],
                [12, "none"],
                [1, "one"],
            ]),
        );
    });

    test("check paints crossings on edges and counts on islands", () => {
        expect(
            bridges.check(
                cross,
                state([
                    [3, 1],
                    [6, 1],
                ]),
            ),
        ).toEqual([
            { keys: [6, 3], kind: "crossing" },
            { keys: [3, 5], kind: "disconnected" },
        ]);
        expect(
            bridges.check(
                square,
                state([
                    [0, 2],
                    [1, 1],
                ]),
            ),
        ).toEqual([{ keys: [0], kind: "over" }]);
    });

    test("under is only reported once every edge of the island is committed", () => {
        const partial = state([[0, 1]]);
        expect(bridges.check(square, partial)).toEqual([]);
        const committed = state([
            [0, 1],
            [1, 0],
        ]);
        expect(bridges.check(square, committed)).toEqual([{ keys: [0], kind: "under" }]);
    });

    test("solved and bytes", () => {
        const ring = state([
            [0, 1],
            [1, 1],
            [5, 1],
            [12, 1],
        ]);
        expect(bridges.solved(square, ring)).toBe(true);
        expect(bridges.solved(square, bridges.empty(square))).toBe(false);
        const bytes = bridges.toBytes(square, ring);
        expect(bytes).toEqual(Uint8Array.from([0, 1, 0, 3, 0, 3, 0, 1, 0]));
        expect(bridges.fromBytes(square, bytes)).toEqual(ring);
        expect(bridges.fromBytes(square, bytes.slice(1))).toBeUndefined();
    });
});

// #9370: hint keys are cells, marks are edges, and the key spaces overlap
describe("hintKeyStatus", () => {
    test("reads a hint's cell key in cell space, never as an edge key", () => {
        // 0 . 2 / . . . / 6 . 8: edge 0 -> 2 has key 0 over cell 1, edge 0 -> 6 has key 1 over
        // cell 3, so cell 1 collides with the vertical edge's key
        const d = desc(["2.2", "...", "2.2"]);
        let state: BridgesState = new Map();
        expect(bridges.hintKeyStatus!(d, state, 0)).toBe("context"); // island
        expect(bridges.hintKeyStatus!(d, state, 4)).toBe("context"); // water no edge crosses
        expect(bridges.hintKeyStatus!(d, state, 1)).toBe("todo");
        // committing the colliding edge (key 1, through cell 3) is not cell 1 being done
        state = bridges.tap(d, state, 1);
        expect(bridges.hintKeyStatus!(d, state, 1)).toBe("todo");
        expect(bridges.hintKeyStatus!(d, state, 3)).toBe("done");
        // the edge through cell 1 is key 0; a bridge or an explicit no-bridge both settle it
        state = bridges.tap(d, state, 0);
        expect(bridges.hintKeyStatus!(d, state, 1)).toBe("done");
        state = bridges.tap(d, bridges.tap(d, state, 0), 0);
        expect(state.get(0)).toBe(0);
        expect(bridges.hintKeyStatus!(d, state, 1)).toBe("done");
    });
});

// #9372: crossing edges share a water cell; each keeps a tap target of its own
describe("bridgesHitShapes", () => {
    // . 1 . / 1 . 1 / . 1 .: the edge 3 -> 5 (key 6) and the edge 1 -> 7 (key 3) both run over
    // the centre cell 4
    const d = desc([".1.", "1.1", ".1."]);

    // invariant 1
    test("every edge has a shape, and in a shared cell each edge has its own", () => {
        const shapes = bridgesHitShapes(d);
        for (const e of d.edges) {
            expect(shapes.some((s) => s.key === e.key)).toBe(true);
        }
        const centre = shapes.filter((s) => s.cell === 4);
        expect(
            centre
                .filter((s) => s.key === 6)
                .map((s) => s.part)
                .sort(),
        ).toEqual(["left", "right"]);
        expect(
            centre
                .filter((s) => s.key === 3)
                .map((s) => s.part)
                .sort(),
        ).toEqual(["bottom", "top"]);
        // an unshared cell stays whole
        const square = desc(["2.2", "...", "2.2"]);
        expect(bridgesHitShapes(square).every((s) => s.part === "whole")).toBe(true);
        expect(
            bridgesHitShapes(square)
                .map((s) => s.cell)
                .sort(),
        ).toEqual([1, 3, 5, 7]);
    });

    // invariant 2: the parts of a cell are disjoint by construction (a whole cell, or the four
    // diagonal quarters split two ways), so no cell may hold a whole alongside a quarter, nor
    // the same quarter twice
    test("shapes of different edges never overlap", () => {
        // the last layout has a two-cell edge crossed at one cell only: that cell splits, the
        // other stays whole
        for (const layout of [
            [".1.", "1.1", ".1."],
            ["2.2", "...", "2.2"],
            ["3.3.", ".1.1", "3.3.", ".1.1"],
            [".1..", "2..2", ".1.."],
        ]) {
            const shapes = bridgesHitShapes(desc(layout));
            const byCell = new Map<number, typeof shapes>();
            for (const s of shapes) byCell.set(s.cell, [...(byCell.get(s.cell) ?? []), s]);
            for (const [cell, list] of byCell) {
                const parts = list.map((s) => s.part);
                const keys = new Set(list.map((s) => s.key));
                if (parts.includes("whole")) {
                    expect(list, `cell ${cell}`).toHaveLength(1);
                } else {
                    expect(parts, `cell ${cell}`).toHaveLength(4);
                    expect(new Set(parts).size, `cell ${cell}`).toBe(4);
                    expect(keys.size, `cell ${cell}`).toBe(2);
                }
            }
        }
    });
});

// #9374: a no-bridge mark is not drawn under a crossing bridge, but the decision stays
describe("no-bridge marks under a crossing bridge", () => {
    test("marks() drops the mark while the crossing edge has a bridge, and keeps the state", () => {
        // . 1 . / 1 . 1 / . 1 .: edge 3 -> 5 (key 6) and edge 1 -> 7 (key 3) cross at cell 4
        const d = desc([".1.", "1.1", ".1."]);
        let st: BridgesState = new Map();
        // cycle the vertical edge to an explicit zero
        st = bridges.tap(d, bridges.tap(d, bridges.tap(d, st, 3), 3), 3);
        expect(st.get(3)).toBe(0);
        expect(bridges.marks(d, st).get(3)).toBe("none");
        // a bridge on the crossing edge hides it; state and filled() are unchanged
        st = bridges.tap(d, st, 6);
        expect(bridges.marks(d, st).has(3)).toBe(false);
        expect(bridges.marks(d, st).get(6)).toBe("one");
        expect(st.get(3)).toBe(0);
        expect(bridges.filled(d, st)).toContainEqual([3, 0]);
        // and it is back once the bridge is gone
        st = bridges.tap(d, bridges.tap(d, st, 6), 6);
        expect(st.get(6)).toBe(0);
        expect(bridges.marks(d, st).get(3)).toBe("none");
        expect(bridges.marks(d, st).get(6)).toBe("none");
    });
});
