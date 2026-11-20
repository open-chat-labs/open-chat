import { writable } from "./stores";
import { describe, expect, test, vi } from "vitest";
import { RECONNECT_DELAYS_MS, reconnectDelay, runWhenOnline, whenOnline } from "./online";

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
});

describe("runWhenOnline", () => {
    test("runs once the app is back, not before", async () => {
        const offline = writable(true);
        const task = vi.fn(() => Promise.resolve("done"));
        const result = runWhenOnline(task, offline);
        await Promise.resolve();
        expect(task).not.toHaveBeenCalled();

        offline.set(false);
        expect(await result).toBe("done");
        expect(task).toHaveBeenCalledTimes(1);
    });

    test("runs again on the next reconnection when it fails because the app went offline", async () => {
        const offline = writable(false);
        const task = vi
            .fn<() => Promise<string>>()
            .mockImplementationOnce(() => {
                offline.set(true);
                return Promise.reject(new Error("network"));
            })
            .mockResolvedValue("done");
        const result = runWhenOnline(task, offline);
        await vi.waitFor(() => expect(task).toHaveBeenCalledTimes(1));
        await Promise.resolve();
        expect(task).toHaveBeenCalledTimes(1);

        offline.set(false);
        expect(await result).toBe("done");
        expect(task).toHaveBeenCalledTimes(2);
    });

    test("passes on a failure while online", async () => {
        const offline = writable(false);
        const task = vi.fn(() => Promise.reject(new Error("refused")));
        await expect(runWhenOnline(task, offline)).rejects.toThrow("refused");
        expect(task).toHaveBeenCalledTimes(1);
    });
});

describe("reconnectDelay", () => {
    test("grows with each attempt, then stays at the longest", () => {
        expect(reconnectDelay(0)).toBe(1_000);
        expect(reconnectDelay(1)).toBe(2_000);
        const longest = RECONNECT_DELAYS_MS[RECONNECT_DELAYS_MS.length - 1];
        expect(reconnectDelay(RECONNECT_DELAYS_MS.length - 1)).toBe(longest);
        expect(reconnectDelay(100)).toBe(longest);
    });
});
