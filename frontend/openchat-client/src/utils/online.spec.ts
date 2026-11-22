import { writable } from "./stores";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
    isAbortError,
    RECONNECT_DELAYS_MS,
    reconnectDelay,
    RUN_WHEN_ONLINE_RETRY_DELAYS_MS,
    runWhenOnline,
    whenOnline,
} from "./online";

afterEach(() => {
    vi.useRealTimers();
});

describe("whenOnline", () => {
    test("calls straight away when online", () => {
        const offline = writable(false);
        const fn = vi.fn();
        whenOnline(fn, offline);
        expect(fn).toHaveBeenCalledTimes(1);

        offline.set(true);
        offline.set(false);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    test("waits while offline and calls once on coming back", () => {
        const offline = writable(true);
        const fn = vi.fn();
        whenOnline(fn, offline);
        expect(fn).not.toHaveBeenCalled();

        offline.set(false);
        expect(fn).toHaveBeenCalledTimes(1);
        offline.set(true);
        offline.set(false);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    test("a cancelled call never happens", () => {
        const offline = writable(true);
        const fn = vi.fn();
        whenOnline(fn, offline)();
        offline.set(false);
        expect(fn).not.toHaveBeenCalled();
    });

    test("a call which throws still leaves the store", () => {
        const offline = writable(false);
        const unsubscribe = vi.fn();
        const store = {
            subscribe: (run: (value: boolean) => void) => {
                const unsub = offline.subscribe(run);
                return () => {
                    unsubscribe();
                    unsub();
                };
            },
        };
        expect(() =>
            whenOnline(() => {
                throw new Error("boom");
            }, store),
        ).toThrow("boom");
        expect(unsubscribe).toHaveBeenCalledTimes(1);
    });
});

describe("runWhenOnline", () => {
    test("runs once the app is back, not before", async () => {
        const offline = writable(true);
        const task = vi.fn(() => Promise.resolve("done"));
        const result = runWhenOnline(task, { offline });
        await Promise.resolve();
        expect(task).not.toHaveBeenCalled();

        offline.set(false);
        expect(await result).toBe("done");
        expect(task).toHaveBeenCalledTimes(1);
    });

    test("tries a failed attempt again after a backoff, though the store still says online", async () => {
        vi.useFakeTimers();
        const offline = writable(false);
        const task = vi
            .fn<() => Promise<string>>()
            .mockRejectedValueOnce(new Error("network"))
            .mockResolvedValue("done");
        const result = runWhenOnline(task, { offline });
        await vi.advanceTimersByTimeAsync(RUN_WHEN_ONLINE_RETRY_DELAYS_MS[0] - 1);
        expect(task).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(1);
        expect(await result).toBe("done");
        expect(task).toHaveBeenCalledTimes(2);
    });

    test("a retry due while offline waits for the app to be back", async () => {
        vi.useFakeTimers();
        const offline = writable(false);
        const task = vi
            .fn<() => Promise<string>>()
            .mockImplementationOnce(() => {
                offline.set(true);
                return Promise.reject(new Error("network"));
            })
            .mockResolvedValue("done");
        const result = runWhenOnline(task, { offline });
        await vi.advanceTimersByTimeAsync(10 * 60_000);
        expect(task).toHaveBeenCalledTimes(1);

        offline.set(false);
        expect(await result).toBe("done");
        expect(task).toHaveBeenCalledTimes(2);
    });

    test("passes on the last failure once the retries are used up", async () => {
        vi.useFakeTimers();
        const offline = writable(false);
        const task = vi.fn(() => Promise.reject(new Error("refused")));
        const settled = runWhenOnline(task, { offline }).catch((err: Error) => err.message);
        await vi.runAllTimersAsync();

        expect(await settled).toBe("refused");
        expect(task).toHaveBeenCalledTimes(RUN_WHEN_ONLINE_RETRY_DELAYS_MS.length + 1);
    });

    test("an abort while waiting to be online drops the task", async () => {
        const offline = writable(true);
        const controller = new AbortController();
        const task = vi.fn(() => Promise.resolve("done"));
        const settled = runWhenOnline(task, { offline, signal: controller.signal }).catch(
            (err: unknown) => err,
        );

        controller.abort();
        offline.set(false);
        expect(isAbortError(await settled)).toBe(true);
        expect(task).not.toHaveBeenCalled();
    });

    test("an abort during the backoff drops the retry", async () => {
        vi.useFakeTimers();
        const offline = writable(false);
        const controller = new AbortController();
        const task = vi.fn(() => Promise.reject(new Error("network")));
        const settled = runWhenOnline(task, { offline, signal: controller.signal }).catch(
            (err: unknown) => err,
        );
        await vi.advanceTimersByTimeAsync(0);
        controller.abort();
        await vi.runAllTimersAsync();

        expect(isAbortError(await settled)).toBe(true);
        expect(task).toHaveBeenCalledTimes(1);
    });
});

describe("reconnectDelay", () => {
    test("is nothing at first, grows with each attempt, then stays at the longest", () => {
        expect(reconnectDelay(0)).toBe(0);
        expect(reconnectDelay(1)).toBe(1_000);
        expect(reconnectDelay(2)).toBe(2_000);
        const longest = RECONNECT_DELAYS_MS[RECONNECT_DELAYS_MS.length - 1];
        expect(reconnectDelay(RECONNECT_DELAYS_MS.length - 1)).toBe(longest);
        expect(reconnectDelay(100)).toBe(longest);
    });
});
