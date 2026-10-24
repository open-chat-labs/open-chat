import type { DemoSpec } from "../types";

// A hand-built 4x4 Tents with three trees, at cells 0, 6 and 9, whose only answer puts the tents
// at 1, 7 and 8.
//
//     T . . .  1        T = tree, ^ = tent
//     . . T ^  1
//     ^ T . .  1
//     . . . .  0
//     1 1 0 1
//
// Description: [version, width, height, 16 cell bytes row-major (0 = empty, 1 = tree), 4 row
// counts, 4 column counts]. Cell key = y*4 + x; conclusion values are 1 = tent, 0 = grass.
//
// The chain the frames walk: cells 3, 11 and 15 have no tree directly beside them, so the one
// tent the last column needs has to go at 7; the middle row is then finished, which empties 4
// and 5 and leaves tree 9 only cell 8.
const T = 1;
const _ = 0;

const demo: DemoSpec = {
    // prettier-ignore
    description: Uint8Array.from([
        1, 4, 4,
        T, _, _, _,
        _, _, T, _,
        _, T, _, _,
        _, _, _, _,
        1, 1, 1, 0,
        1, 1, 0, 1,
    ]),
    frames: [
        {
            // The goal, stated once against an empty grid.
            marks: [],
            caption: "demo.1",
        },
        {
            // The rule people get wrong. Cells 3 and 11 sit on the corners of tree 6 and 15 is
            // nowhere near a tree, so none of the three can ever hold a tent.
            marks: [
                [3, 0],
                [11, 0],
                [15, 0],
            ],
            caption: "demo.2",
            target: [3, 11, 15],
        },
        {
            // The last column needs one tent and only cell 7 is left.
            marks: [
                [3, 0],
                [11, 0],
                [15, 0],
                [7, 1],
            ],
            caption: "demo.3",
            target: [3, 7, 11, 15],
        },
        {
            // The mistake. Tents at 5 and 8 meet at a corner, so the checker paints both red.
            // Neither is lonely and neither line is over its count, so the touch is the only
            // thing the frame says.
            marks: [
                [3, 0],
                [11, 0],
                [15, 0],
                [5, 1],
                [8, 1],
            ],
            caption: "demo.4",
            target: [5, 8],
        },
        {
            // The middle row already has its one tent, so 4 and 5 are empty; with 10 and 13 out
            // on the zero column and zero row, tree 9 has only cell 8 left.
            marks: [
                [3, 0],
                [11, 0],
                [15, 0],
                [7, 1],
                [4, 0],
                [5, 0],
                [10, 0],
                [13, 0],
                [8, 1],
            ],
            caption: "demo.5",
            target: [8, 9],
        },
        {
            // The finished grid.
            marks: [
                [1, 1],
                [7, 1],
                [8, 1],
                [2, 0],
                [3, 0],
                [4, 0],
                [5, 0],
                [10, 0],
                [11, 0],
                [12, 0],
                [13, 0],
                [14, 0],
                [15, 0],
            ],
            caption: "demo.6",
        },
    ],
};

export default demo;
