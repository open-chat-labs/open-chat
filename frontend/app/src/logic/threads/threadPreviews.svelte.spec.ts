import { ChatMap, type ThreadPreview, type ThreadSyncDetails } from "@client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ThreadPreviews } from "./threadPreviews.svelte";

const preview = (rootIndex: number) =>
    ({
        chatId: { kind: "group_chat", groupId: "g1" },
        rootMessage: { index: rootIndex, timestamp: 1n, event: { messageIndex: rootIndex } },
        latestReplies: [],
        totalReplies: 1,
    }) as unknown as ThreadPreview;

const threads = () => new ChatMap<ThreadSyncDetails[]>();

describe("ThreadPreviews", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    test("loads at once the first time, then once the threads have settled", async () => {
        const load = vi.fn(async () => [preview(1)]);
        const previews = new ThreadPreviews(load, 300);
        expect(previews.previews).toEqual({ kind: "loading" });
        await previews.set(threads());
        expect(load).toHaveBeenCalledTimes(1);
        expect(previews.previews).toEqual({ kind: "loaded", threads: [preview(1)] });

        void previews.set(threads());
        void previews.set(threads());
        await vi.advanceTimersByTimeAsync(299);
        expect(load).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(load).toHaveBeenCalledTimes(2);
    });

    test("keeps the list it has while the next one loads (no spinner on a reload)", async () => {
        let answer: (threads: ThreadPreview[]) => void = () => {};
        const load = vi
            .fn<() => Promise<ThreadPreview[] | undefined>>()
            .mockResolvedValueOnce([preview(1)])
            .mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
        const previews = new ThreadPreviews(load, 10);
        await previews.set(threads());
        const reloaded = previews.set(threads());
        await vi.advanceTimersByTimeAsync(10);
        expect(previews.previews).toEqual({ kind: "loaded", threads: [preview(1)] });
        answer([preview(1), preview(2)]);
        await reloaded;
        expect(previews.previews).toEqual({ kind: "loaded", threads: [preview(1), preview(2)] });
    });

    test("a failed load shows none and says so", async () => {
        const previews = new ThreadPreviews(async () => undefined, 10);
        const failure = await previews.set(threads());
        expect(failure?.key).toBe("thread.previewFailure");
        expect(previews.previews).toEqual({ kind: "loaded", threads: [] });
    });

    test("a load replaced by a later one settles with nothing and never runs", async () => {
        const load = vi
            .fn<() => Promise<ThreadPreview[] | undefined>>()
            .mockResolvedValueOnce([preview(1)])
            .mockResolvedValueOnce([preview(3)]);
        const previews = new ThreadPreviews(load, 10);
        await previews.set(threads());
        const replaced = previews.set(threads());
        const latest = previews.set(threads());
        expect(await replaced).toBeUndefined();
        await vi.advanceTimersByTimeAsync(10);
        expect(await latest).toBeUndefined();
        expect(load).toHaveBeenCalledTimes(2);
        expect(previews.previews).toEqual({ kind: "loaded", threads: [preview(3)] });
    });

    test("an answer coming back after a later load was asked for is dropped", async () => {
        let first: (threads: ThreadPreview[]) => void = () => {};
        const load = vi
            .fn<() => Promise<ThreadPreview[] | undefined>>()
            .mockImplementationOnce(() => new Promise((resolve) => (first = resolve)))
            .mockResolvedValueOnce([preview(2)]);
        const previews = new ThreadPreviews(load, 10);
        const stale = previews.set(threads());
        const latest = previews.set(threads());
        await vi.advanceTimersByTimeAsync(10);
        await latest;
        first([preview(1)]);
        expect(await stale).toBeUndefined();
        expect(previews.previews).toEqual({ kind: "loaded", threads: [preview(2)] });
    });

    test("a load still waiting when it's disposed never runs", async () => {
        const load = vi.fn(async () => [preview(1)]);
        const previews = new ThreadPreviews(load, 10);
        await previews.set(threads());
        const waiting = previews.set(threads());
        previews.dispose();
        await vi.advanceTimersByTimeAsync(10);
        expect(await waiting).toBeUndefined();
        expect(load).toHaveBeenCalledTimes(1);
    });
});
