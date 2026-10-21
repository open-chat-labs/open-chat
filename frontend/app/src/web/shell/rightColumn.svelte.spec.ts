import { flushSync } from "svelte";
import type { ShellLayout } from "./layout";
import { RightColumnState } from "./rightColumn.svelte";

describe("the right column's open state", () => {
    let mode = $state<ShellLayout["right"]>("dock");
    let cleanup = () => {};

    function create(): RightColumnState {
        let state!: RightColumnState;
        cleanup = $effect.root(() => {
            state = new RightColumnState(() => mode);
        });
        flushSync();
        return state;
    }

    function setMode(next: ShellLayout["right"]) {
        mode = next;
        flushSync();
    }

    beforeEach(() => localStorage.clear());
    afterEach(() => {
        cleanup();
        mode = "dock";
        localStorage.clear();
    });

    test("docked, it starts open", () => {
        expect(create().open).toBe(true);
    });

    test("docked, closing it is remembered for the next visit", () => {
        create().open = false;
        cleanup();
        const next = create();
        expect(next.open).toBe(false);
        next.toggle();
        cleanup();
        expect(create().open).toBe(true);
    });

    test("as a modal, it starts closed and isn't remembered", () => {
        setMode("modal");
        const state = create();
        expect(state.open).toBe(false);
        state.toggle();
        expect(state.open).toBe(true);
        cleanup();
        expect(create().open).toBe(false);
    });

    test("opening the modal leaves the docked preference alone", () => {
        const state = create();
        state.open = false;
        setMode("modal");
        state.open = true;
        setMode("dock");
        expect(state.open).toBe(false);
    });

    test("a modal left open doesn't reopen after the window has been wide", () => {
        setMode("modal");
        const state = create();
        state.open = true;
        setMode("dock");
        setMode("modal");
        expect(state.open).toBe(false);
    });
});
