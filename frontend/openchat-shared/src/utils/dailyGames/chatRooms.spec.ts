import { describe, expect, test } from "vitest";
import {
    chatRooms,
    checkRules,
    hintCaption,
    parseDescription,
    ruledOut,
    type ChatRoomsCell,
    type ChatRoomsDescription,
} from "./chatRooms";
import { descriptionFromHex } from "../../domain/dailyPuzzle";
import fixture from "./chatRoomsHints.json";

// Rows of size letters, one room per letter: 'a' is room 0, 'b' room 1 and so on.
function descBytes(rows: string[]): number[] {
    const rooms = rows
        .join("")
        .split("")
        .map((ch) => ch.charCodeAt(0) - 97);
    return [1, rows.length, rows.length, ...rooms];
}

function desc(rows: string[]): ChatRoomsDescription {
    return parseDescription(descBytes(rows));
}

// Rows of size characters: '*' a logo, 'x' a cross, '.' empty.
function grid(rows: string[]): ChatRoomsCell[] {
    return rows
        .join("")
        .split("")
        .map((ch) => (ch === "*" ? "logo" : ch === "x" ? "cross" : "empty"));
}

// A 5x5 that `answer` solves: rooms are the columns, except that the centre cell is
// room a's.
const puzzle = desc(["abcde", "abcde", "abade", "abcde", "abcde"]);
const answer = grid(["*....", "..*..", "....*", ".*...", "...*."]);

describe("parseDescription", () => {
    test("reads the size and rooms", () => {
        expect(puzzle.size).toBe(5);
        expect(puzzle.rooms[12]).toBe(0);
        expect(puzzle.rooms[13]).toBe(3);
    });

    test("rejects malformed bytes", () => {
        const good = descBytes(["abcde", "abcde", "abcde", "abcde", "abcde"]);
        const wrongVersion = [2, ...good.slice(1)];
        // 25 room bytes: the length a 5x5 needs, so only the square check can refuse it
        const notSquare = [1, 5, 6, ...good.slice(3)];
        const short = good.slice(0, -1);
        const roomTooBig = [...good.slice(0, 3), 5, ...good.slice(4)];
        const roomMissing = [...good.slice(0, 3), ...good.slice(3).map((r) => (r === 4 ? 3 : r))];
        const tooSmall = [1, 4, 4, ...Array.from({ length: 16 }, (_, i) => i % 4)];
        for (const bad of [wrongVersion, notSquare, short, roomTooBig, roomMissing, tooSmall]) {
            expect(() => parseDescription(bad)).toThrow();
        }
    });
});

// Invariant 22: the client reads every size the generator can serve, Monday's 9x9 included,
// and no size it cannot
describe("board sizes", () => {
    const board = (n: number) => [1, n, n, ...Array.from({ length: n * n }, (_, i) => i % n)];

    test("every size from 5 to 9 parses", () => {
        for (let n = 5; n <= 9; n++) expect(parseDescription(board(n)).size).toBe(n);
    });

    test("4 and 10 do not", () => {
        expect(() => parseDescription(board(4))).toThrow();
        expect(() => parseDescription(board(10))).toThrow();
    });
});

describe("checkRules", () => {
    test("an unfinished grid with nothing wrong is clean", () => {
        expect(checkRules(puzzle, chatRooms.empty(puzzle))).toEqual([]);
        expect(checkRules(puzzle, grid(["*....", "..*..", ".....", ".....", "....."]))).toEqual([]);
    });

    test("reports each rule broken alone", () => {
        expect(checkRules(puzzle, grid(["*..*.", ".....", ".....", ".....", "....."]))).toEqual([
            { kind: "row", row: 0, cells: [0, 3] },
        ]);
        expect(checkRules(puzzle, grid(["..*..", ".....", "..*..", ".....", "....."]))).toEqual([
            { kind: "column", column: 2, cells: [2, 12] },
        ]);
        expect(checkRules(puzzle, grid([".....", "*....", "..*..", ".....", "....."]))).toEqual([
            { kind: "room", room: 0, cells: [5, 12] },
        ]);
        expect(checkRules(puzzle, grid([".....", ".*...", "..*..", ".....", "....."]))).toEqual([
            { kind: "touching", a: 6, b: 12 },
        ]);
    });

    test("crosses are never logos", () => {
        expect(checkRules(puzzle, grid(["xxxxx", "xxxxx", ".....", ".....", "....."]))).toEqual([]);
    });
});

describe("chatRooms", () => {
    test("the answer is solved and one logo short is not", () => {
        expect(chatRooms.solved(puzzle, answer)).toBe(true);
        const short = [...answer];
        short[0] = "empty";
        expect(chatRooms.solved(puzzle, short)).toBe(false);
    });

    // Invariant 10: the server compares bytes with a solution that is 0 wherever there is no
    // logo, so a cross must submit as 0 or a correctly solved grid would be refused.
    test("crosses submit as empty so a correct grid matches the solution", () => {
        const withCrosses = answer.map((c) => (c === "empty" ? "cross" : c));
        expect(chatRooms.solved(puzzle, withCrosses)).toBe(true);
        expect(chatRooms.toBytes(puzzle, withCrosses)).toEqual(chatRooms.toBytes(puzzle, answer));
        expect(Array.from(chatRooms.toBytes(puzzle, withCrosses))).toEqual(
            answer.map((c) => (c === "logo" ? 1 : 0)),
        );
    });

    test("bytes round-trip the logos", () => {
        const bytes = chatRooms.toBytes(puzzle, answer);
        expect(chatRooms.fromBytes(puzzle, bytes)).toEqual(answer);
        expect(chatRooms.fromBytes(puzzle, bytes.slice(1))).toBeUndefined();
    });

    test("hint conclusions set a logo or a cross, and filled reports both", () => {
        let state = chatRooms.empty(puzzle);
        state = chatRooms.apply(puzzle, state, 0, 1);
        state = chatRooms.apply(puzzle, state, 1, 0);
        expect(state[0]).toBe("logo");
        expect(state[1]).toBe("cross");
        expect(chatRooms.filled(puzzle, state)).toEqual([
            [0, 1],
            [1, 0],
        ]);
    });

    test("clashes paint the logos involved", () => {
        expect(
            chatRooms.check(puzzle, grid(["*..*.", ".....", ".....", ".....", "....."])),
        ).toEqual([{ keys: [0, 3], kind: "clash" }]);
        expect(
            chatRooms.check(puzzle, grid([".....", ".*...", "..*..", ".....", "....."])),
        ).toEqual([{ keys: [6, 12], kind: "clash" }]);
    });
});

// The board crosses out, for the player, every cell a placed CHAT rules out. Those crosses are
// drawn from the logos, never stored.
describe("automatic crosses", () => {
    // One logo in the top-left corner: its row, its column, room a (column 0 and the centre) and
    // the three cells touching it
    const oneLogo = grid(["*....", ".....", ".....", ".....", "....."]);
    const expected = [1, 2, 3, 4, 5, 6, 10, 12, 15, 20];

    test("are the placed CHATs' row, column, room and neighbours, less the logos", () => {
        expect([...ruledOut(puzzle, oneLogo)].sort((a, b) => a - b)).toEqual(expected);
        expect(ruledOut(puzzle, chatRooms.empty(puzzle)).size).toBe(0);
        // two logos that clash: neither is crossed out under the other
        const clash = grid(["*..*.", ".....", ".....", ".....", "....."]);
        expect(ruledOut(puzzle, clash).has(0)).toBe(false);
        expect(ruledOut(puzzle, clash).has(3)).toBe(false);
        expect(chatRooms.lit?.(puzzle, oneLogo)).toEqual(ruledOut(puzzle, oneLogo));
    });

    // Invariant 14: nothing saves them, so a reload never turns them into the player's own
    // crosses, and taking the CHAT away takes them with it
    test("are never saved and leave with the CHAT that made them", () => {
        expect(chatRooms.filled(puzzle, oneLogo)).toEqual([[0, 1]]);
        expect(Array.from(chatRooms.toBytes(puzzle, oneLogo)).filter((b) => b !== 0)).toEqual([1]);
        const removed = chatRooms.tap(puzzle, oneLogo, 0);
        expect(ruledOut(puzzle, removed).size).toBe(0);
    });

    // Invariant 15: a hint request tells the server they are crossed, so it does not sell a
    // step whose crosses the board already shows
    test("go with a hint request as no-logo marks, alongside the player's own", () => {
        const withOwnCross = [...oneLogo];
        withOwnCross[24] = "cross";
        withOwnCross[1] = "cross";
        const sent = chatRooms.hintFilled!(puzzle, withOwnCross);
        expect(sent).toContainEqual([0, 1]);
        expect(sent).toContainEqual([24, 0]);
        for (const k of expected) expect(sent).toContainEqual([k, 0]);
        // each key once, even where the player crossed a cell the logo also rules out
        expect(new Set(sent.map(([k]) => k)).size).toBe(sent.length);
    });

    // Invariant 16: a hint asking for a cell the board has already crossed counts it as done
    test("count as done for a hint", () => {
        expect(chatRooms.hintKeyStatus!(puzzle, oneLogo, 5)).toBe("done");
        expect(chatRooms.hintKeyStatus!(puzzle, oneLogo, 0)).toBe("done");
        expect(chatRooms.hintKeyStatus!(puzzle, oneLogo, 7)).toBe("todo");
    });
});

// Invariant 24: every step of a generated trace, as the server serves it (the target withheld
// when it names a concluded key, no conclusions), gets a caption. The fixture is written by the
// Rust test `write_hint_fixture` from real generated puzzles.
test("every hint step gets a caption", () => {
    expect(fixture.length).toBeGreaterThan(0);
    for (const [p, entry] of fixture.entries()) {
        const d = parseDescription(descriptionFromHex(entry.description));
        let state = chatRooms.empty(d);
        for (const [i, step] of entry.steps.entries()) {
            const concluded = step.conclusions.map(([k]) => k);
            const target = step.target.some((k) => concluded.includes(k)) ? [] : step.target;
            const caption = hintCaption(d, state, {
                technique: step.technique,
                focus: step.focus,
                target,
            });
            expect(caption?.key, `puzzle ${p} step ${i}`).toBeTruthy();
            for (const [k, v] of step.conclusions) state = chatRooms.apply(d, state, k, v);
        }
    }
});
