import { afterEach, describe, expect, test, vi } from "vitest";
import { waitForOnline } from "./waitForOnline";

afterEach(() => {
    vi.useRealTimers();
});

describe("waitForOnline", () => {
    test("resolves at once when online", async () => {
        expect(await waitForOnline(1_000, () => true, new EventTarget())).toBe(true);
    });

    test("waits for the online event", async () => {
        vi.useFakeTimers();
        let online = false;
        const events = new EventTarget();
        let result: boolean | undefined;
        void waitForOnline(1_000, () => online, events).then((r) => (result = r));

        await vi.advanceTimersByTimeAsync(999);
        expect(result).toBeUndefined();
        online = true;
        events.dispatchEvent(new Event("online"));
        await vi.advanceTimersByTimeAsync(0);
        expect(result).toBe(true);
    });

    test("gives up after the timeout", async () => {
        vi.useFakeTimers();
        const result = waitForOnline(1_000, () => false, new EventTarget());
        await vi.advanceTimersByTimeAsync(1_000);
        expect(await result).toBe(false);
    });
});
