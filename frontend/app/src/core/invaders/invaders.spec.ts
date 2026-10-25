import { describe, expect, test, vi } from "vitest";
import { collides, InvadersGame, type Steering } from "./invaders";

const still: Steering = { left: false, right: false, tilt: null };

function playing(width = 600, height = 500, columns = 8) {
    const game = new InvadersGame(width, height, columns);
    game.start();
    return game;
}

describe("a game of Invaders", () => {
    test("starts with the ship in the middle of the bottom row and a wave of five rows", () => {
        const game = new InvadersGame(600, 500, 8);
        expect(game.state).toBe("not_started");
        expect([game.ship.x, game.ship.y]).toEqual([285, 470]);
        expect(game.invaders).toHaveLength(40);
        expect(new InvadersGame(300, 500, 5).invaders).toHaveLength(25);
    });

    test("fires only while playing", () => {
        const game = new InvadersGame(600, 500, 8);
        expect(game.fire()).toBe(false);
        game.start();
        expect(game.fire()).toBe(true);
        expect(game.shots[0]).toMatchObject({ x: 300, y: 470 });
    });

    test("the ship moves with the keys and the tilt, and stays on the field", () => {
        const game = playing();
        game.update({ ...still, left: true });
        expect(game.ship.x).toBe(280);
        game.update({ ...still, tilt: 20 });
        expect(game.ship.x).toBe(284);
        game.ship.x = 0;
        game.update({ ...still, left: true });
        expect(game.ship.x).toBe(0);
    });

    test("the invaders march to the edge, drop a step and turn back", () => {
        const game = playing(200, 500, 2);
        const first = game.invaders[0];
        const startY = first.y;
        // the right-hand column reaches the edge, then the wave drops and heads left
        while (first.y === startY) game.update(still);
        expect(first.y).toBe(startY + 8);
        const x = first.x;
        game.update(still);
        expect(first.x).toBeLessThan(x);
    });

    test("a hit scores 10 and takes the invader out", () => {
        const game = playing();
        const target = game.invaders[0];
        game.shots.push({ x: target.x + 5, y: target.y + 15, width: 3, height: 10, speed: 0 });
        game.update(still);
        expect(game.score).toBe(10);
        expect(target.alive).toBe(false);
    });

    test("a cleared wave brings a new one", () => {
        const game = playing();
        game.invaders.forEach((i) => (i.alive = false));
        game.update(still);
        expect(game.invaders.filter((i) => i.alive)).toHaveLength(40);
    });

    test("ends once an invader reaches the ship's row, a better score being the new high score", () => {
        const onHighScore = vi.fn();
        const game = new InvadersGame(600, 500, 8, 20, onHighScore);
        game.start();
        game.score = 30;
        game.invaders[0].y = game.ship.y;
        game.update(still);
        expect(game.state).toBe("game_over");
        expect([game.newHighScore, game.highScore]).toEqual([true, 30]);
        expect(onHighScore).toHaveBeenCalledWith(30);
    });

    test("a score that doesn't beat the high score leaves it", () => {
        const onHighScore = vi.fn();
        const game = new InvadersGame(600, 500, 8, 50, onHighScore);
        game.start();
        game.score = 30;
        game.invaders[0].y = game.ship.y;
        game.update(still);
        expect([game.newHighScore, game.highScore]).toEqual([false, 50]);
        expect(onHighScore).not.toHaveBeenCalled();
    });

    test("a new game after one ends starts again from nothing", () => {
        const game = playing();
        game.score = 40;
        game.invaders[0].y = game.ship.y;
        game.update(still);
        game.reset();
        expect([game.state, game.score, game.invaders.length]).toEqual(["not_started", 0, 40]);
    });
});

describe("a collision", () => {
    test("is two objects overlapping, not touching", () => {
        const a = { x: 0, y: 0, width: 10, height: 10 };
        expect(collides(a, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
        expect(collides(a, { x: 10, y: 0, width: 10, height: 10 })).toBe(false);
    });
});
