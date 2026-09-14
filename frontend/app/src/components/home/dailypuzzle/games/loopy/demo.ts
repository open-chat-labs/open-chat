import type { DemoSpec } from "../types";

// A hand-built 3x3 Loopy whose answer is the square loop around the top-left four cells.
//
// Description: [version, width, height, 9 clue bytes row-major], 0xFF = no clue. Most cells are
// left blank on purpose: the demo has to show that a blank cell constrains nothing, which is the
// thing the rules sentence cannot say without getting long.
//
// Edge keys for a 3x3 grid: horizontals first, 4 rows of 3 (top edge of cell (x, y) is y*3 + x),
// then verticals, 3 rows of 4 (left edge of cell (x, y) is 12 + y*4 + x). The answer's eight
// lines are the top pair 0 and 1, the right pair 14 and 18, the bottom pair 6 and 7, and the
// left pair 12 and 16.
const NO = 0xff;

const demo: DemoSpec = {
    description: Uint8Array.from([1, 3, 3, 2, NO, 1, NO, NO, NO, 1, NO, 0]),
    frames: [
        {
            // The goal, stated once against an empty grid.
            marks: [],
            caption: "demo.1",
        },
        {
            // The cheapest deduction in the game, and the one to look for first: a 0 rules out
            // all four of its own sides. Cell 8 is the bottom-right, edges 8, 23, 11 and 22.
            marks: [
                [8, 0],
                [23, 0],
                [11, 0],
                [22, 0],
            ],
            caption: "demo.2",
            target: [8, 23, 11, 22],
        },
        {
            // Three lines of the answer, drawn as a player would.
            marks: [
                [0, 1],
                [1, 1],
                [14, 1],
            ],
            caption: "demo.3",
        },
        {
            // A loose end. The other edge at the top-left dot is crossed off so the checker can
            // see the dot is finished with one line, which is what makes it paint red.
            marks: [
                [0, 1],
                [1, 1],
                [12, 0],
            ],
            caption: "demo.4",
            target: [0, 12],
        },
        {
            // A branch: three lines meeting at the dot between the two top cells.
            marks: [
                [0, 1],
                [1, 1],
                [13, 1],
            ],
            caption: "demo.5",
            target: [0, 1, 13],
        },
        {
            // The finished loop.
            marks: [
                [0, 1],
                [1, 1],
                [14, 1],
                [18, 1],
                [6, 1],
                [7, 1],
                [12, 1],
                [16, 1],
            ],
            caption: "demo.6",
        },
    ],
};

export default demo;
