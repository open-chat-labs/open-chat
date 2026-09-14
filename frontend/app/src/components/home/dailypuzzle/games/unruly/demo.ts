import type { DemoSpec } from "../types";

// A hand-built 6x6 Unruly. These eighteen givens have exactly one answer:
//
//     1 2 1 2 2 1
//     1 2 2 1 2 1
//     2 1 2 1 1 2
//     2 1 1 2 2 1
//     1 2 2 1 1 2
//     2 1 1 2 1 2
//
// Description: [version, width, height, 36 given bytes row-major], 0 = blank, 1 = the first
// value (orange), 2 = the second (purple). Cell key is y*6+x, and a mark's value is 1 or 2:
// there is no "empty" conclusion in this game.
//
// `apply` ignores givens, so every frame below places its marks on empty cells only; the givens
// are already on the board and the rule checker sees them either way.
const demo: DemoSpec = {
    // prettier-ignore
    description: Uint8Array.from([
        1, 6, 6,
        0, 0, 1, 0, 2, 0,
        1, 0, 0, 1, 0, 1,
        2, 0, 0, 1, 1, 0,
        2, 0, 1, 0, 0, 0,
        1, 2, 2, 1, 0, 2,
        0, 1, 1, 0, 1, 0,
    ]),
    frames: [
        {
            // The goal, stated once against the bare givens.
            marks: [],
            caption: "demo.1",
        },
        {
            // Two oranges placed to the left of the given orange at cell 2: three across the top
            // row, which the checker paints red on its own.
            marks: [
                [0, 1],
                [1, 1],
            ],
            caption: "demo.2",
            target: [0, 1, 2],
        },
        {
            // Row 3 already holds a given purple at 18. Three more purples take it to four, one
            // over the three a six-wide row is allowed, and none of them sit three in a row: the
            // red is the count, not a run.
            marks: [
                [19, 2],
                [22, 2],
                [23, 2],
            ],
            caption: "demo.3",
            target: [18, 19, 22, 23],
        },
        {
            // The deduction the mistake above teaches. Row 1 has given oranges at 9 and 11 with
            // one gap between them, so cell 10 can only be purple.
            marks: [[10, 2]],
            caption: "demo.4",
            target: [9, 10, 11],
        },
        {
            // The finished grid: every empty cell of the puzzle, filled with its answer.
            marks: [
                [0, 1],
                [1, 2],
                [3, 2],
                [5, 1],
                [7, 2],
                [8, 2],
                [10, 2],
                [13, 1],
                [14, 2],
                [17, 2],
                [19, 1],
                [21, 2],
                [22, 2],
                [23, 1],
                [28, 1],
                [30, 2],
                [33, 2],
                [35, 2],
            ],
            caption: "demo.5",
        },
    ],
};

export default demo;
