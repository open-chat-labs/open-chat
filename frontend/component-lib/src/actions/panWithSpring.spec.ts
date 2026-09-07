import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { panWithSpring, type PanProps } from "./panWithSpring.svelte";

// Pretend we are on a touch device (and avoid importing the whole component library).
vi.mock("component-lib", () => ({ isTouchDevice: true }));

// svelte/motion needs matchMedia at import time; jsdom has none.
vi.hoisted(() => {
    window.matchMedia = (() => ({
        matches: false,
        addEventListener() {},
        removeEventListener() {},
    })) as unknown as typeof window.matchMedia;
});

function touch(type: string, x: number, y: number = 0) {
    const e = new Event(type);
    Object.defineProperty(e, "touches", { value: [{ clientX: x, clientY: y }] });
    return e;
}

// Let svelte effects flush and the spring settle
async function settle() {
    await vi.advanceTimersByTimeAsync(2000);
}

function setup(props: Partial<PanProps> = {}) {
    const node = document.createElement("div");
    const onmove = vi.fn();
    const oncommit = vi.fn();
    const action = panWithSpring(node, { onmove, oncommit, ...props });
    return { node, onmove, oncommit, action };
}

async function pan(node: HTMLElement, dx: number) {
    node.dispatchEvent(touch("touchstart", 100));
    // past the activation threshold (30px) to start panning
    node.dispatchEvent(touch("touchmove", 100 + Math.sign(dx) * 40));
    node.dispatchEvent(touch("touchmove", 100 + Math.sign(dx) * 40 + dx));
    await settle();
}

function lastMove(onmove: ReturnType<typeof vi.fn>) {
    return onmove.mock.calls[onmove.mock.calls.length - 1];
}

describe("panWithSpring", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("does not call onmove or set will-change at setup", async () => {
        const { node, onmove } = setup();
        await settle();
        expect(onmove).not.toHaveBeenCalled();
        expect(node.style.willChange).toBe("");
        expect(node.style.transform).toBe("translateX(0px)");
    });

    it("reports moves and holds will-change while panning, releases at rest", async () => {
        const { node, onmove, oncommit } = setup();
        await pan(node, 50);
        expect(node.style.willChange).toBe("transform");
        expect(node.style.transform).toBe("translateX(50px)");
        expect(lastMove(onmove)).toEqual(["right", 0.625]);

        node.dispatchEvent(touch("touchend", 0));
        await settle();
        expect(node.style.willChange).toBe("auto");
        expect(node.style.transform).toBe("translateX(0px)");
        expect(lastMove(onmove)).toEqual(["right", 0]);
        expect(oncommit).not.toHaveBeenCalled();
    });

    it("commits when the threshold is reached", async () => {
        const { node, onmove, oncommit } = setup();
        await pan(node, -90);
        expect(lastMove(onmove)).toEqual(["left", 1]);
        node.dispatchEvent(touch("touchend", 0));
        expect(oncommit).toHaveBeenCalledWith("left");
        await settle();
        expect(lastMove(onmove)).toEqual(["right", 0]);
        expect(node.style.willChange).toBe("auto");
    });

    it("ignores touches while scrolling", async () => {
        const { node, onmove, action } = setup();
        action?.update({ isScrolling: true });
        await pan(node, 50);
        expect(onmove).not.toHaveBeenCalled();
        expect(node.style.willChange).toBe("");
    });

    it("a tap (no pan) never reports a move", async () => {
        const { node, onmove } = setup();
        node.dispatchEvent(touch("touchstart", 100));
        node.dispatchEvent(touch("touchmove", 105));
        node.dispatchEvent(touch("touchend", 0));
        await settle();
        expect(onmove).not.toHaveBeenCalled();
        expect(node.style.willChange).toBe("");
    });

    it("removes listeners on destroy", async () => {
        const { node, onmove, action } = setup();
        action?.destroy();
        await pan(node, 50);
        expect(onmove).not.toHaveBeenCalled();
    });
});
