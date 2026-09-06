import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { longpress } from "./longpress";

// Pretend we are on a touch device (and avoid importing the whole component library).
vi.mock("component-lib", () => ({ isTouchDevice: true, mobileOperatingSystem: "iOS" }));

function touch(type: string, x: number = 200, y: number = 200) {
    const e = new Event(type, { cancelable: true });
    Object.defineProperty(e, "changedTouches", { value: [{ screenX: x, screenY: y }] });
    Object.defineProperty(e, "touches", { value: [{ clientX: x, clientY: y }] });
    return e;
}

describe("longpress", () => {
    let getComputedStyle: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.useFakeTimers();
        getComputedStyle = vi.spyOn(window, "getComputedStyle");
    });
    afterEach(() => {
        vi.useRealTimers();
        getComputedStyle.mockRestore();
    });

    it("does not read computed style until the first touch", () => {
        const node = document.createElement("div");
        longpress(node, { onlongpress: () => {}, animation: "scale" });
        expect(getComputedStyle).not.toHaveBeenCalled();
        expect(node.style.transition).toBe("");

        node.dispatchEvent(touch("touchstart"));
        expect(getComputedStyle).toHaveBeenCalledTimes(2);
        expect(node.style.transition).toBe("scale 150ms ease-out");

        // Only ever read once
        node.dispatchEvent(touch("touchend"));
        node.dispatchEvent(touch("touchstart"));
        expect(getComputedStyle).toHaveBeenCalledTimes(2);
    });

    it("reads the scale once but sets no transition when animation is none", () => {
        const node = document.createElement("div");
        longpress(node, { onlongpress: () => {} });
        node.dispatchEvent(touch("touchstart"));
        expect(getComputedStyle).toHaveBeenCalledTimes(1);
        expect(node.style.transition).toBe("");
    });

    it("fires onlongpress after 80% of the delay and animates the scale", async () => {
        const node = document.createElement("div");
        const onlongpress = vi.fn();
        const onpressactive = vi.fn();
        longpress(node, { onlongpress, onpressactive, animation: "scale", delay: 600 });

        node.dispatchEvent(touch("touchstart"));
        await vi.advanceTimersByTimeAsync(300);
        expect(onpressactive).toHaveBeenCalledTimes(1);
        expect(node.style.scale).toBe("0.95");
        expect(onlongpress).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(180);
        expect(onlongpress).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(100);
        // restored to the (jsdom: empty) computed scale
        expect(node.style.scale).not.toBe("0.95");
    });

    it("cancels when the finger moves", async () => {
        const node = document.createElement("div");
        const onlongpress = vi.fn();
        longpress(node, { onlongpress });
        node.dispatchEvent(touch("touchstart"));
        node.dispatchEvent(touch("touchmove", 220, 200));
        await vi.advanceTimersByTimeAsync(1000);
        expect(onlongpress).not.toHaveBeenCalled();
    });

    it("ignores edge touches", async () => {
        const node = document.createElement("div");
        const onlongpress = vi.fn();
        longpress(node, { onlongpress });
        node.dispatchEvent(touch("touchstart", 5, 200));
        await vi.advanceTimersByTimeAsync(1000);
        expect(onlongpress).not.toHaveBeenCalled();
        expect(getComputedStyle).not.toHaveBeenCalled();
    });
});
