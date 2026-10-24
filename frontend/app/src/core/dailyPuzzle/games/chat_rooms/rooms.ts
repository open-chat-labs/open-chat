// Room fills and walls shared by the CHAT Rooms board and pictogram.
import { CELL } from "../gridSvg";

// One fill per room, with one to spare over the largest board (9). Neighbouring entries differ
// in lightness as well as hue, and the walls between rooms are drawn dark, so rooms read apart
// without colour.
const ROOM_FILLS = [
    "#b9a7e8",
    "#ffcf99",
    "#9cc3ff",
    "#b6e3a3",
    "#e2e2e2",
    "#ff8f78",
    "#eaf58f",
    "#c2b8a3",
    "#e6a8c8",
    "#a8dbe0",
];

export function roomFill(room: number, greyed = false): string {
    return greyed ? "#e6e6e6" : ROOM_FILLS[room % ROOM_FILLS.length];
}

export type Wall = { x1: number; y1: number; x2: number; y2: number };

/** The edges between cells of different rooms, in gridSvg units. */
export function walls(size: number, rooms: number[]): Wall[] {
    const out: Wall[] = [];
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const i = y * size + x;
            if (x + 1 < size && rooms[i] !== rooms[i + 1]) {
                const wx = (x + 1) * CELL;
                out.push({ x1: wx, y1: y * CELL, x2: wx, y2: (y + 1) * CELL });
            }
            if (y + 1 < size && rooms[i] !== rooms[i + size]) {
                const wy = (y + 1) * CELL;
                out.push({ x1: x * CELL, y1: wy, x2: (x + 1) * CELL, y2: wy });
            }
        }
    }
    return out;
}
