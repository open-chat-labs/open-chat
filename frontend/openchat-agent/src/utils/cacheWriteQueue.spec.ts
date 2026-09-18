import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CacheWriteQueue } from "./cacheWriteQueue";

function deferred() {
    let resolve!: () => void;
    let reject!: (err: unknown) => void;
    const promise = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

describe("CacheWriteQueue", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test("runs tasks one at a time, in the order they were queued", async () => {
        const queue = new CacheWriteQueue(1000);
        const first = deferred();
        const started: string[] = [];

        const a = queue.run(async () => {
            started.push("a");
            await first.promise;
            return "a";
        });
        const b = queue.run(async () => {
            started.push("b");
            return "b";
        });
        await vi.advanceTimersByTimeAsync(0);
        expect(started).toEqual(["a"]);

        first.resolve();
        expect(await a).toBe("a");
        expect(await b).toBe("b");
        expect(started).toEqual(["a", "b"]);
    });

    test("a task that fails rejects its own caller and does not hold up the next", async () => {
        const queue = new CacheWriteQueue(1000);
        const failed = queue.run(() => Promise.reject(new Error("boom")));
        const next = queue.run(() => Promise.resolve(1));
        await expect(failed).rejects.toThrow("boom");
        expect(await next).toBe(1);
    });

    test("a hung task stops holding up the queue once it has run for the max wait", async () => {
        const queue = new CacheWriteQueue(1000);
        const hung = deferred();
        const started: string[] = [];

        void queue.run(async () => {
            started.push("hung");
            await hung.promise;
        });
        const b = queue.run(async () => {
            started.push("b");
        });
        const c = queue.run(async () => {
            started.push("c");
        });

        await vi.advanceTimersByTimeAsync(999);
        expect(started).toEqual(["hung"]);
        await vi.advanceTimersByTimeAsync(1);
        await b;
        await c;
        // only the hung task's own wait is paid, not once per task behind it
        expect(started).toEqual(["hung", "b", "c"]);
    });

    test("the wait is timed from when a task starts, not from when it was queued", async () => {
        const queue = new CacheWriteQueue(1000);
        const first = deferred();
        const second = deferred();
        const started: string[] = [];

        void queue.run(async () => {
            started.push("first");
            await first.promise;
        });
        void queue.run(async () => {
            started.push("second");
            await second.promise;
        });
        void queue.run(async () => {
            started.push("third");
        });

        await vi.advanceTimersByTimeAsync(800);
        first.resolve();
        await vi.advanceTimersByTimeAsync(0);
        expect(started).toEqual(["first", "second"]);

        // second started at 800ms, so it holds the queue until 1800ms
        await vi.advanceTimersByTimeAsync(999);
        expect(started).toEqual(["first", "second"]);
        await vi.advanceTimersByTimeAsync(1);
        expect(started).toEqual(["first", "second", "third"]);
        second.resolve();
    });
});
