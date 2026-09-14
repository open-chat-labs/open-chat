import { describe, expect, test } from "vitest";
import { descriptionFromHex } from "../../domain/dailyPuzzle";
import { bridges, lightUp, loopy, slant, tents, unruly } from "./index";
import fixture from "./parity.json";
import type { DailyGame } from "./types";

// #9332 invariant 37. `parity.json` is written by the daily_puzzle canister's test
// `client_parity_fixture_is_current` from the real generators, and that test fails when the
// fixture drifts from them. Every entry is a puzzle the Rust `check_rules` accepted as solved,
// so the TypeScript checker must accept it too, and must refuse every single-cell change to it.
const games = Object.fromEntries(
    [lightUp, tents, slant, bridges, loopy, unruly].map((g) => [
        g.id,
        g as DailyGame<unknown, unknown>,
    ]),
);

describe("client checkers agree with the Rust check_rules", () => {
    test("the fixture covers every game", () => {
        expect(new Set(fixture.map((e) => e.gameId))).toEqual(new Set(Object.keys(games)));
    });

    for (const entry of fixture) {
        test(`${entry.gameId} seed ${entry.seed}`, () => {
            const game = games[entry.gameId];
            const model = game.parse(descriptionFromHex(entry.description));
            const solved = game.fromBytes(model, descriptionFromHex(entry.solution));
            expect(solved).toBeDefined();
            expect(game.check(model, solved)).toEqual([]);
            expect(game.solved(model, solved)).toBe(true);

            let changes = 0;
            for (const el of game.elements(model)) {
                if (el.kind === "vertex") continue;
                const changed = game.tap(model, solved, el.key);
                if (changed === solved) continue;
                changes += 1;
                expect(game.solved(model, changed), `key ${el.key} changed`).toBe(false);
            }
            expect(changes).toBeGreaterThan(0);
        });
    }
});
