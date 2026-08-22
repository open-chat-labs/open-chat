import { vi } from "vitest";
import { Poller } from "./poller";

describe("Poller", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test("runs immediately and then on the interval", async () => {
        const fn = vi.fn(() => Promise.resolve());
        const poller = new Poller(fn, 1000, undefined, true);
        await vi.advanceTimersByTimeAsync(0);
        expect(fn).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1000);
        expect(fn).toHaveBeenCalledTimes(2);
        poller.stop();
    });

    test("does not run immediately when immediate is false", async () => {
        const fn = vi.fn(() => Promise.resolve());
        const poller = new Poller(fn, 1000, undefined, false);
        await vi.advanceTimersByTimeAsync(999);
        expect(fn).toHaveBeenCalledTimes(0);
        await vi.advanceTimersByTimeAsync(1);
        expect(fn).toHaveBeenCalledTimes(1);
        poller.stop();
    });

    test("stop prevents further runs", async () => {
        const fn = vi.fn(() => Promise.resolve());
        const poller = new Poller(fn, 1000, undefined, true);
        await vi.advanceTimersByTimeAsync(0);
        expect(fn).toHaveBeenCalledTimes(1);
        poller.stop();
        await vi.advanceTimersByTimeAsync(10_000);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    test("an unreferenced poller keeps running (the leak shape fixed in openchat.ts)", async () => {
        const fn = vi.fn(() => Promise.resolve());
        const first = new Poller(fn, 1000, undefined, false);
        const second = new Poller(fn, 1000, undefined, false);
        await vi.advanceTimersByTimeAsync(1000);
        expect(fn).toHaveBeenCalledTimes(2);
        first.stop();
        await vi.advanceTimersByTimeAsync(1000);
        expect(fn).toHaveBeenCalledTimes(3);
        second.stop();
    });
});
