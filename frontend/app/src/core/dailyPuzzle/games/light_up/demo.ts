import type { DemoSpec } from "../types";

// A hand-built 5x5 Light Up. Black cells at the top-left and bottom-right corners, a 4 in the
// middle, and nothing else. The 4 forces the four cells around it, which lights everything
// except the other two corners, and each of those can only be lit by a bulb standing in it.
//
// Description: [version, width, height, 25 cell bytes row-major], 0x00 = white,
// 0x10 = black, 0x11..0x15 = black with clue 0..4. Cell key = y*5 + x.
//
//     #  .  .  .  .      keys  0  1  2  3  4
//     .  .  .  .  .            5  6  7  8  9
//     .  .  4  .  .           10 11 12 13 14
//     .  .  .  .  .           15 16 17 18 19
//     .  .  .  .  #           20 21 22 23 24
//
// The answer is bulbs at 7, 11, 13, 17 (around the 4), 4 (top-right corner) and 20
// (bottom-left corner).
const W = 0x00;
const B = 0x10;
const FOUR = 0x15;

const CLUE_BULBS: [number, number][] = [
    [7, 1],
    [11, 1],
    [13, 1],
    [17, 1],
];

const demo: DemoSpec = {
    // prettier-ignore
    description: Uint8Array.from([
        1, 5, 5,
        B, W, W, W, W,
        W, W, W, W, W,
        W, W, FOUR, W, W,
        W, W, W, W, W,
        W, W, W, W, B,
    ]),
    frames: [
        {
            // The goal, stated once against an empty grid.
            marks: [],
            caption: "demo.1",
        },
        {
            // One bulb on its own, so the light it casts is the only thing on the board: the
            // whole of its row, and its column up to the black cell below it.
            marks: [[7, 1]],
            caption: "demo.2",
            target: [7],
        },
        {
            // The opening deduction: the 4 has exactly four cells around it, so all four
            // hold a bulb. None of them see each other, because the 4 stands between them.
            marks: CLUE_BULBS,
            caption: "demo.3",
            target: [7, 11, 13, 17],
        },
        {
            // Those four light every cell but the two far corners. Nothing in the top row or
            // the right column can light key 4 without shining on a bulb, so it takes its own.
            marks: [...CLUE_BULBS, [4, 1]],
            caption: "demo.4",
            target: [4],
        },
        {
            // The mistake: reaching the last dark corner from next door instead. The bulb at
            // 21 looks straight up column 1 at the bulb at 11, so the checker paints both red.
            marks: [...CLUE_BULBS, [4, 1], [21, 1]],
            caption: "demo.5",
            target: [11, 21],
        },
        {
            // The finished grid.
            marks: [...CLUE_BULBS, [4, 1], [20, 1]],
            caption: "demo.6",
        },
    ],
};

export default demo;
