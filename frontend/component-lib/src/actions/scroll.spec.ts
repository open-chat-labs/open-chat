import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scrollLimits } from "./scroll";

function makeNode(scrollHeight: number, clientHeight: number) {
    const node = document.createElement("div");
    Object.defineProperty(node, "scrollHeight", { value: scrollHeight });
    Object.defineProperty(node, "clientHeight", { value: clientHeight });
    return node;
}

async function scrollTo(node: HTMLElement, top: number) {
    node.scrollTop = top;
    node.dispatchEvent(new Event("scroll"));
    await vi.advanceTimersByTimeAsync(20);
}

describe("scrollLimits", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("does nothing without callbacks", () => {
        const node = makeNode(2000, 500);
        const add = vi.spyOn(node, "addEventListener");
        expect(scrollLimits(node, {})).toBeUndefined();
        expect(add).not.toHaveBeenCalled();
    });

    it("registers a passive listener and reports distance from start/end inside the threshold", async () => {
        const node = makeNode(2000, 500);
        const add = vi.spyOn(node, "addEventListener");
        const onStart = vi.fn();
        const onEnd = vi.fn();
        const action = scrollLimits(node, { onStart, onEnd });
        expect(add.mock.calls[0][2]).toEqual({ passive: true });

        await scrollTo(node, 100);
        expect(onStart).toHaveBeenCalledWith(100);
        expect(onEnd).not.toHaveBeenCalled();

        await scrollTo(node, 800);
        expect(onStart).toHaveBeenCalledTimes(1);
        expect(onEnd).not.toHaveBeenCalled();

        await scrollTo(node, 1300);
        expect(onEnd).toHaveBeenCalledWith(200);

        action?.destroy();
        await scrollTo(node, 1400);
        expect(onEnd).toHaveBeenCalledTimes(1);
    });

    it("coalesces a burst of scroll events into one callback per frame", async () => {
        const node = makeNode(2000, 500);
        const onStart = vi.fn();
        scrollLimits(node, { onStart });
        for (let i = 0; i < 10; i++) {
            node.scrollTop = i;
            node.dispatchEvent(new Event("scroll"));
        }
        await vi.advanceTimersByTimeAsync(20);
        expect(onStart).toHaveBeenCalledTimes(1);
        expect(onStart).toHaveBeenCalledWith(9);
    });
});
