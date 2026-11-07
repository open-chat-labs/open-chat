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

    describe("for a thread", () => {
        test("docked and closed, it shows for the thread and closes again with it, unremembered", () => {
            const state = create();
            state.open = false;
            state.showThread();
            expect(state.open).toBe(true);
            cleanup();
            // a reload meanwhile finds the user's choice
            expect(create().open).toBe(false);
        });

        test("docked and closed, it closes again with the thread", () => {
            const state = create();
            state.open = false;
            state.showThread();
            state.threadClosed();
            expect(state.open).toBe(false);
        });

        test("docked and open, closing the thread leaves it open", () => {
            const state = create();
            state.showThread();
            state.threadClosed();
            expect(state.open).toBe(true);
        });

        test("as a modal, it opens for the thread and closes with it unless it was open", () => {
            setMode("modal");
            const state = create();
            state.showThread();
            expect(state.open).toBe(true);
            state.threadClosed();
            expect(state.open).toBe(false);
            state.open = true;
            state.showThread();
            state.threadClosed();
            expect(state.open).toBe(true);
        });

        test("the user closing it while a thread shows closes it, and that's their choice", () => {
            const state = create();
            state.open = false;
            state.showThread();
            state.toggle();
            expect(state.open).toBe(false);
            state.threadClosed();
            expect(state.open).toBe(false);
            cleanup();
            expect(create().open).toBe(false);
        });

        test("it stays shown when the window crosses the docking width", () => {
            const state = create();
            state.open = false;
            state.showThread();
            setMode("modal");
            expect(state.open).toBe(true);
            setMode("dock");
            expect(state.open).toBe(true);
        });
    });
});
