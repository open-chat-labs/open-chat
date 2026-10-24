import type { DemoSpec } from "../types";

// A 5x5 from the chat_rooms generator (seed 3, Easy), so its one answer is the generator's:
//
//     a a * a b
//     c a a c *
//     c * c c b
//     c c c * d
//     * c d d d
//
// Description: [version, size, size, 25 room ids row-major]. Cell key is y*5+x, and a mark's
// value is 1 for a logo or 0 for a cross.
const demo: DemoSpec = {
    // prettier-ignore
    description: Uint8Array.from([
        1, 5, 5,
        0, 0, 0, 0, 1,
        2, 0, 0, 2, 1,
        2, 2, 2, 2, 1,
        2, 2, 2, 3, 3,
        4, 2, 3, 3, 3,
    ]),
    frames: [
        {
            // The goal, stated once against the bare rooms.
            marks: [],
            caption: "demo.1",
        },
        {
            // Diagonal neighbours in different rows, columns and rooms: only the touch is wrong.
            marks: [
                [16, 1],
                [20, 1],
            ],
            caption: "demo.2",
            target: [16, 20],
        },
        {
            // 0 and 7 share nothing but the top room.
            marks: [
                [0, 1],
                [7, 1],
            ],
            caption: "demo.3",
            target: [0, 7],
        },
        {
            // The bottom-left room is one cell, so its logo goes there, and the board crosses off
            // everything that logo rules out.
            marks: [[20, 1]],
            caption: "demo.4",
            target: [20],
        },
        {
            // The finished grid.
            marks: [
                [2, 1],
                [9, 1],
                [11, 1],
                [18, 1],
                [20, 1],
            ],
            caption: "demo.5",
        },
    ],
};

export default demo;
