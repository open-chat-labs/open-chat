import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { PendingRemovals } from "./pendingRemovals.svelte";

describe("PendingRemovals", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    test("takes the chat off the list at once, and sends it once Undo has had its time", () => {
        const removals = new PendingRemovals(5000);
        const commit = vi.fn();
        removals.remove("g1", commit);
        expect(removals.has("g1")).toBe(true);
        vi.advanceTimersByTime(4999);
        expect(commit).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(commit).toHaveBeenCalledTimes(1);
        // the client's own update takes it off the list from here
        expect(removals.has("g1")).toBe(false);
    });

    test("Undo puts it back and sends nothing", () => {
        const removals = new PendingRemovals(5000);
        const commit = vi.fn();
        removals.remove("g1", commit);
        removals.undo("g1");
        expect(removals.has("g1")).toBe(false);
        vi.advanceTimersByTime(5000);
        expect(commit).not.toHaveBeenCalled();
    });

    test("a chat already waiting keeps its first commit", () => {
        const removals = new PendingRemovals(5000);
        const first = vi.fn();
        const second = vi.fn();
        removals.remove("g1", first);
        removals.remove("g1", second);
        vi.advanceTimersByTime(5000);
        expect(first).toHaveBeenCalledTimes(1);
        expect(second).not.toHaveBeenCalled();
    });

    test("sends what's still waiting when the list goes away, once", () => {
        const removals = new PendingRemovals(5000);
        const commit = vi.fn();
        removals.remove("g1", commit);
        removals.flush();
        vi.advanceTimersByTime(5000);
        expect(commit).toHaveBeenCalledTimes(1);
    });

    test("settles once it's sent, or undone, so the Undo offered for it can go", () => {
        const removals = new PendingRemovals(5000);
        const sent = vi.fn();
        const undone = vi.fn();
        removals.remove("g1", () => {}, sent);
        removals.remove("g2", () => {}, undone);
        removals.undo("g2");
        expect(undone).toHaveBeenCalledTimes(1);
        expect(sent).not.toHaveBeenCalled();
        vi.advanceTimersByTime(5000);
        expect(sent).toHaveBeenCalledTimes(1);
        removals.undo("g1");
        removals.flush();
        expect([sent, undone].map((f) => f.mock.calls.length)).toEqual([1, 1]);
    });

    test("settles when the list goes away and sends it: its Undo can't work from then", () => {
        const removals = new PendingRemovals(5000);
        const commit = vi.fn();
        const settled = vi.fn();
        removals.remove("g1", commit, settled);
        removals.flush();
        expect(settled).toHaveBeenCalledTimes(1);
        expect(commit).toHaveBeenCalledTimes(1);
        removals.undo("g1");
        vi.advanceTimersByTime(5000);
        expect(settled).toHaveBeenCalledTimes(1);
    });
});
