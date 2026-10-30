import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MiniAppFullScreen, MiniAppPresence, type FrameDialog } from "./miniAppFrame.svelte";

describe("MiniAppPresence", () => {
    let onScreen: (visible: boolean) => void;
    let unobserved: number;
    let presence: MiniAppPresence;
    let stop: () => void;

    beforeEach(() => {
        vi.useFakeTimers();
        unobserved = 0;
        presence = new MiniAppPresence((_, handler) => {
            onScreen = handler;
            return () => unobserved++;
        }, 1000);
        stop = presence.observe(document.createElement("div"));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test("the app's shown once the card's on screen", () => {
        expect(presence.shown).toBe(false);
        onScreen(true);
        expect(presence.shown).toBe(true);
    });

    test("and stays shown for a while after the card leaves the screen", () => {
        onScreen(true);
        onScreen(false);
        expect(presence.shown).toBe(true);
        vi.advanceTimersByTime(999);
        expect(presence.shown).toBe(true);
        vi.advanceTimersByTime(1);
        expect(presence.shown).toBe(false);
    });

    test("scrolling past the card and back keeps the app shown", () => {
        onScreen(true);
        onScreen(false);
        vi.advanceTimersByTime(900);
        onScreen(true);
        vi.advanceTimersByTime(900);
        expect(presence.shown).toBe(true);
        onScreen(false);
        vi.advanceTimersByTime(1000);
        expect(presence.shown).toBe(false);
    });

    test("a card that's never been on screen shows nothing", () => {
        onScreen(false);
        vi.advanceTimersByTime(1000);
        expect(presence.shown).toBe(false);
    });

    test("while held, the app stays shown off screen, and leaves a while after it's released", () => {
        onScreen(true);
        presence.hold(true);
        onScreen(false);
        vi.advanceTimersByTime(5000);
        expect(presence.shown).toBe(true);
        presence.hold(false);
        expect(presence.shown).toBe(true);
        vi.advanceTimersByTime(999);
        expect(presence.shown).toBe(true);
        vi.advanceTimersByTime(1);
        expect(presence.shown).toBe(false);
    });

    test("holding a card that's never been on screen shows its app", () => {
        presence.hold(true);
        expect(presence.shown).toBe(true);
    });

    test("stopping hides the app at once", () => {
        onScreen(true);
        stop();
        expect(presence.shown).toBe(false);
        expect(unobserved).toBe(1);
        onScreen(false);
        vi.advanceTimersByTime(1000);
        expect(presence.shown).toBe(false);
    });
});

describe("MiniAppFullScreen", () => {
    // A dialog element's behaviour: open in place to begin with
    class FakeDialog implements FrameDialog {
        open = true;
        modal = false;
        calls: string[] = [];
        #onClose: (() => void) | undefined;

        show(): void {
            this.calls.push("show");
            this.open = true;
            this.modal = false;
        }

        showModal(): void {
            if (this.open) throw new Error("InvalidStateError");
            this.calls.push("showModal");
            this.open = true;
            this.modal = true;
        }

        close(): void {
            this.calls.push("close");
            this.open = false;
            this.modal = false;
            // The event is fired after the current task
            queueMicrotask(() => this.#onClose?.());
        }

        addEventListener(type: string, listener: unknown): void {
            if (type === "close") this.#onClose = listener as () => void;
        }

        removeEventListener(type: string): void {
            if (type === "close") this.#onClose = undefined;
        }
    }

    const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

    let dialog: FakeDialog;
    let fullScreen: MiniAppFullScreen;
    let detach: () => void;

    beforeEach(() => {
        dialog = new FakeDialog();
        fullScreen = new MiniAppFullScreen();
        detach = fullScreen.attach(dialog);
    });

    test("going full screen reopens the dialog as a modal, and leaving it reopens it in place", async () => {
        expect(fullScreen.on).toBe(false);
        fullScreen.toggle();
        expect(fullScreen.on).toBe(true);
        expect(dialog.modal).toBe(true);
        await settle();
        // the close event from the switch doesn't take it back
        expect(fullScreen.on).toBe(true);
        expect(dialog.modal).toBe(true);

        fullScreen.toggle();
        expect(fullScreen.on).toBe(false);
        expect(dialog.open).toBe(true);
        expect(dialog.modal).toBe(false);
        expect(dialog.calls).toEqual(["close", "showModal", "close", "show"]);
    });

    test("the browser closing the modal, with Escape, leaves full screen", async () => {
        fullScreen.enter();
        dialog.close();
        await settle();
        expect(fullScreen.on).toBe(false);
        expect(dialog.open).toBe(true);
        expect(dialog.modal).toBe(false);
    });

    test("entering or leaving twice does nothing more", () => {
        fullScreen.enter();
        fullScreen.enter();
        fullScreen.exit();
        fullScreen.exit();
        expect(dialog.calls).toEqual(["close", "showModal", "close", "show"]);
    });

    test("once detached, nothing's done to the dialog", async () => {
        detach();
        fullScreen.enter();
        expect(fullScreen.on).toBe(false);
        expect(dialog.calls).toEqual([]);
    });
});
