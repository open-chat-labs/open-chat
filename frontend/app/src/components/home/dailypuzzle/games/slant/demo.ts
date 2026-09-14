import type { DemoSpec } from "../types";

// A hand-built 3x3 Slant. Its answer is
//
//     \ / \
//     / \ \
//     / / /
//
// It is the only answer to these clues.
//
// Description: [version, width, height, 16 corner clue bytes row-major], 0xFF = no clue. Only
// five of the sixteen corners carry a number: 1 top-left, 2 on the top edge, 4 in the middle of
// the top-left four cells, 1 on the bottom edge and 0 bottom-right. The other eleven are blank
// on purpose, because the demo has to show that a corner with no number constrains nothing.
//
// Keys: cell (x, y) is y*3 + x, so 0..8 row-major. Corner (vx, vy) is 9 + vy*4 + vx, so the
// clued corners are keys 9 (the 1), 11 (the 2), 14 (the 4), 23 (the 1) and 24 (the 0).
// Values: 1 = backslash, 2 = slash.
const NO = 0xff;

const demo: DemoSpec = {
    // prettier-ignore
    description: Uint8Array.from([
        1, 3, 3,
        1,  NO, 2,  NO,
        NO, 4,  NO, NO,
        NO, NO, NO, NO,
        NO, NO, 1,  0,
    ]),
    frames: [
        {
            // The goal, stated once against an empty grid.
            marks: [],
            caption: "demo.1",
        },
        {
            // What a number means. Both diagonals touch the corner marked 2, so it is satisfied,
            // and the board greys the clue out.
            marks: [
                [1, 2],
                [2, 1],
            ],
            caption: "demo.2",
            target: [11],
        },
        {
            // The same picture, with the highlight moved to the other end of the same diagonal,
            // a corner with no number and so nothing to count. The marks are deliberately
            // identical, so the only thing that changes is which corner is being talked about.
            marks: [
                [1, 2],
                [2, 1],
            ],
            caption: "demo.3",
            target: [16],
        },
        {
            // The cheapest deduction in the game: a 4 forces all four cells around it to point
            // at it, which is the only way to give it four diagonals.
            marks: [
                [0, 1],
                [1, 2],
                [3, 2],
                [4, 1],
            ],
            caption: "demo.4",
            target: [14, 0, 1, 3, 4],
        },
        {
            // The one mistake. Cells 1, 2, 4 and 5 close a ring, so the checker paints all four
            // red on its own. Only cell 5 differs from the answer.
            marks: [
                [0, 1],
                [1, 2],
                [2, 1],
                [3, 2],
                [4, 1],
                [5, 2],
            ],
            caption: "demo.5",
            target: [1, 2, 4, 5],
        },
        {
            // The finished grid.
            marks: [
                [0, 1],
                [1, 2],
                [2, 1],
                [3, 2],
                [4, 1],
                [5, 1],
                [6, 2],
                [7, 2],
                [8, 2],
            ],
            caption: "demo.6",
        },
    ],
};

export default demo;
