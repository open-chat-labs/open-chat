import { flushSync } from "svelte";
import type { ShellLayout } from "./layout";
import { RailState } from "./railState.svelte";

describe("the nav rail's expanded state", () => {
    let mode: ShellLayout["rail"] = "push";
    let cleanup = () => {};

    function create(): RailState {
        cleanup();
        let state!: RailState;
        cleanup = $effect.root(() => {
            state = new RailState(() => mode);
        });
        flushSync();
        return state;
    }

    beforeEach(() => localStorage.clear());
    afterEach(() => {
        cleanup();
        cleanup = () => {};
        mode = "push";
        localStorage.clear();
    });

    test("starts collapsed", () => {
        expect(create().expanded).toBe(false);
    });

    test("where it pushes, the user's choice is remembered for the next visit", () => {
        create().expanded = true;
        expect(create().expanded).toBe(true);
        create().expanded = false;
        expect(create().expanded).toBe(false);
    });

    test("where it floats, it starts collapsed, whatever was remembered", () => {
        create().expanded = true;
        mode = "float";
        expect(create().expanded).toBe(false);
    });

    test("where it floats, expanding it isn't remembered", () => {
        mode = "float";
        create().expanded = true;
        mode = "push";
        expect(create().expanded).toBe(false);
    });
});
