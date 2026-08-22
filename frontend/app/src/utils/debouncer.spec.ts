import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Debouncer } from "./debouncer";

describe("Debouncer", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("only invokes the function with the last input once the delay elapses", () => {
        const fn = vi.fn();
        const d = new Debouncer<string>(fn, 100);
        d.execute("a");
        d.execute("b");
        vi.advanceTimersByTime(99);
        expect(fn).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith("b");
    });

    it("restarts the delay on each execute", () => {
        const fn = vi.fn();
        const d = new Debouncer<string>(fn, 100);
        d.execute("a");
        vi.advanceTimersByTime(80);
        d.execute("b");
        vi.advanceTimersByTime(80);
        expect(fn).not.toHaveBeenCalled();
        vi.advanceTimersByTime(20);
        expect(fn).toHaveBeenCalledWith("b");
    });

    it("cancel() drops the pending invocation", () => {
        const fn = vi.fn();
        const d = new Debouncer<string>(fn, 100);
        d.execute("a");
        d.cancel();
        vi.advanceTimersByTime(200);
        expect(fn).not.toHaveBeenCalled();
    });

    it("can execute again after cancel()", () => {
        const fn = vi.fn();
        const d = new Debouncer<string>(fn, 100);
        d.execute("a");
        d.cancel();
        d.execute("b");
        vi.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith("b");
    });

    it("cancel() is a no-op when nothing is pending", () => {
        const fn = vi.fn();
        const d = new Debouncer<string>(fn, 100);
        expect(() => d.cancel()).not.toThrow();
        vi.advanceTimersByTime(200);
        expect(fn).not.toHaveBeenCalled();
    });
});
