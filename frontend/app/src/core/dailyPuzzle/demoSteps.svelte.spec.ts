import { describe, expect, test } from "vitest";
import { DemoSteps } from "./demoSteps.svelte";
import { dailyPuzzleGames } from "./registry";

const bridges = dailyPuzzleGames.bridges;

describe("stepping through a game's demo", () => {
    test("starts on the first frame and stops at either end", () => {
        const steps = new DemoSteps(bridges);
        const count = bridges.demo?.frames.length ?? 0;
        expect(count).toBeGreaterThan(1);
        expect(steps.count).toBe(count);
        expect(steps.isFirst).toBe(true);
        steps.prev();
        expect(steps.index).toBe(0);
        for (let i = 0; i < count + 2; i++) steps.next();
        expect(steps.index).toBe(count - 1);
        expect(steps.isLast).toBe(true);
    });

    test("draws each frame's marks with the game's own board", () => {
        const steps = new DemoSteps(bridges);
        expect(steps.frame).toBe(bridges.demo?.frames[0]);
        expect(steps.board).toBeDefined();
    });

    test("a tap on the board steps on, and past the last frame starts again", () => {
        const steps = new DemoSteps(bridges);
        steps.tapBoard();
        expect(steps.index).toBe(1);
        steps.index = steps.last;
        steps.tapBoard();
        expect(steps.index).toBe(0);
    });

    test("a frame that breaks a rule points at nothing, so the mistake's red shows alone", () => {
        const steps = new DemoSteps(bridges);
        for (let i = 0; i < steps.count; i++) {
            steps.index = i;
            if (steps.violations.length > 0) expect(steps.pointed.size).toBe(0);
            else expect([...steps.pointed]).toEqual(steps.frame?.target ?? []);
        }
    });

    test("a game without a demo has no frames", () => {
        const steps = new DemoSteps({ demo: undefined, newBoard: bridges.newBoard });
        expect(steps.count).toBe(0);
        expect(steps.frame).toBeUndefined();
        expect(steps.board).toBeUndefined();
    });
});
