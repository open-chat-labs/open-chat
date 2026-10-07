import { mount, unmount } from "svelte";
import { afterEach, describe, expect, test } from "vitest";
import { dailyPuzzleGame } from "../../../../utils/dailyPuzzleGames";

// #9404 invariant 5: every game with a "no" mark draws it with the shared NoMark cross, two
// grey lines on the cell or edge centre, so the mark reads the same from game to game
const NO_MARK_LINE = 'line[stroke="#8a8a8a"]';

function boardWithNoMark(gameId: string, description: number[], key: number): HTMLElement {
    const board = dailyPuzzleGame(gameId)!.newBoard(new Uint8Array(description), [[key, 0]]);
    const target = document.createElement("div");
    document.body.appendChild(target);
    const app = mount(board.Board, {
        target,
        props: {
            board,
            violations: board.violations,
            focus: new Set<number>(),
            target: new Set<number>(),
            onTap: () => {},
        },
    });
    cleanups.push(() => {
        unmount(app);
        target.remove();
    });
    return target;
}

const cleanups: (() => void)[] = [];
afterEach(() => {
    cleanups.splice(0).forEach((c) => c());
});

describe('the "no" mark is the shared cross in every game', () => {
    test("Light Up", () => {
        const el = boardWithNoMark("light_up", [1, 3, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0], 4);
        expect(el.querySelectorAll(NO_MARK_LINE)).toHaveLength(2);
    });

    test("Tents", () => {
        // 2x2, a tree at 0, no counts to satisfy
        const el = boardWithNoMark("tents", [1, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0], 3);
        expect(el.querySelectorAll(NO_MARK_LINE)).toHaveLength(2);
    });

    test("Bridges", () => {
        // 0 . 2 / . . . / 6 . 8: edge key 0 is 0 -> 2
        const el = boardWithNoMark("bridges", [1, 3, 3, 2, 0, 2, 0, 0, 0, 2, 0, 2], 0);
        expect(el.querySelectorAll(NO_MARK_LINE)).toHaveLength(2);
    });

    test("Loopy", () => {
        const el = boardWithNoMark("loopy", [1, 2, 2, 0xff, 0xff, 0xff, 0xff], 0);
        expect(el.querySelectorAll(NO_MARK_LINE)).toHaveLength(2);
    });
});
