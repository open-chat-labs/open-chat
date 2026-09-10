import type { DemoSpec } from "../types";

// A hand-built 4x4 Bridges with an island in each corner:
//
//     3 . . 3
//     . . . .
//     . . . .
//     2 . . 2
//
// Description: [version, width, height, 16 cell bytes row-major], 0 = water, 1..8 = an island
// wanting that many bridge ends. The answer is a ring: two bridges along the top, one down each
// side, one along the bottom. Nothing here can cross (the four edges hug the border), so the
// mistake frame is an island given more bridge ends than its number.
//
// Edge keys are `from_cell * 2 + dir`, dir 0 = right, 1 = down, from the left / top island:
// 0 = the top pair (0 to 3), 1 = the left pair (0 to 12), 7 = the right pair (3 to 15),
// 24 = the bottom pair (12 to 15). Frame targets are plain cell indices, not edge keys: the
// water a bridge runs through, or the island being talked about.
const W = 0;

const demo: DemoSpec = {
    // prettier-ignore
    description: Uint8Array.from([
        1, 4, 4,
        3, W, W, 3,
        W, W, W, W,
        W, W, W, W,
        2, W, W, 2,
    ]),
    frames: [
        {
            // The goal, stated once against an empty grid.
            marks: [],
            caption: "demo.1",
        },
        {
            // One bridge, along the bottom. Neither island is finished, and neither has all of
            // its bridges settled, so nothing is flagged yet.
            marks: [[24, 1]],
            caption: "demo.2",
            target: [13, 14],
        },
        {
            // A second bridge on the same pair, along the top.
            marks: [
                [24, 1],
                [0, 2],
            ],
            caption: "demo.3",
            target: [1, 2],
        },
        {
            // Too many. Two along the top plus two down the left gives the 3 in the top-left
            // four bridge ends, so the checker paints it red.
            marks: [
                [0, 2],
                [1, 2],
            ],
            caption: "demo.4",
            target: [0],
        },
        {
            // One bridge down instead of two, and the top-left island is right.
            marks: [
                [0, 2],
                [1, 1],
            ],
            caption: "demo.5",
            target: [0],
        },
        {
            // The finished ring: every number met and every island reachable from every other.
            marks: [
                [0, 2],
                [1, 1],
                [7, 1],
                [24, 1],
            ],
            caption: "demo.6",
        },
    ],
};

export default demo;
