import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scrollStatus } from "./scroll.svelte";

function scroll() {
    window.dispatchEvent(new Event("scroll"));
}

function snapshot() {
    return [scrollStatus.isScrolling, scrollStatus.isCooldown];
}

describe("scrollStatus", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(async () => {
        await vi.advanceTimersByTimeAsync(1000);
        vi.useRealTimers();
    });

    it("is idle initially", () => {
        expect(snapshot()).toEqual([false, false]);
    });

    it("flips exactly twice per scroll burst: leading edge and trailing reset", async () => {
        const seen: string[] = [];
        const record = () => {
            const s = JSON.stringify(snapshot());
            if (seen[seen.length - 1] !== s) seen.push(s);
        };

        record();
        for (let i = 0; i < 20; i++) {
            await vi.advanceTimersByTimeAsync(16);
            scroll();
            record();
        }
        expect(snapshot()).toEqual([true, true]);

        await vi.advanceTimersByTimeAsync(149);
        record();
        expect(snapshot()).toEqual([true, true]);
        await vi.advanceTimersByTimeAsync(1);
        record();
        expect(snapshot()).toEqual([false, false]);

        expect(seen).toEqual(["[false,false]", "[true,true]", "[false,false]"]);
    });

    it("extends the scrolling window while events keep arriving", async () => {
        scroll();
        await vi.advanceTimersByTimeAsync(100);
        scroll();
        await vi.advanceTimersByTimeAsync(100);
        expect(snapshot()).toEqual([true, true]);
        await vi.advanceTimersByTimeAsync(50);
        expect(snapshot()).toEqual([false, false]);
    });
});
