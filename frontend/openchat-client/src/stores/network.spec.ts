import { offline } from "@shared";
import { vi } from "vitest";
import { connectionUnusableChanged, offlineStore } from "./network";

function currentOffline(): boolean {
    let value = false;
    offlineStore.subscribe((v) => (value = v))();
    return value;
}

describe("offline detection", () => {
    afterEach(() => {
        connectionUnusableChanged(false);
        Reflect.deleteProperty(navigator, "connection");
    });

    // Invariant 3: the browser's estimates never decide whether the app is offline. They stop
    // changing while the app sends nothing, which left it offline until reopened.
    test("a dire downlink estimate doesn't make the app offline", () => {
        vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
        Object.defineProperty(navigator, "connection", {
            configurable: true,
            value: { downlink: 0, rtt: 3000, effectiveType: "slow-2g", saveData: false },
        });

        expect(offline()).toBe(false);
        expect(currentOffline()).toBe(false);
    });

    // Invariant 5: the main thread follows the worker's measurements
    test("follows the connection health the worker reports", () => {
        connectionUnusableChanged(true);
        expect(offline()).toBe(true);
        expect(currentOffline()).toBe(true);

        connectionUnusableChanged(false);
        expect(offline()).toBe(false);
        expect(currentOffline()).toBe(false);
    });

    // A review point on #10570: the value read at module load can be stale by the first subscriber
    test("reads the browser's state again when the store gets its first subscriber", () => {
        const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
        // nothing subscribes while this changes, so no event would tell the store
        onLine.mockReturnValue(false);
        expect(currentOffline()).toBe(true);

        onLine.mockReturnValue(true);
        expect(currentOffline()).toBe(false);
        onLine.mockRestore();
    });

    test("follows the online and offline events while subscribed", () => {
        const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
        const values: boolean[] = [];
        const unsubscribe = offlineStore.subscribe((v) => values.push(v));

        window.dispatchEvent(new Event("offline"));
        window.dispatchEvent(new Event("online"));
        unsubscribe();
        onLine.mockRestore();

        expect(values).toEqual([false, true, false]);
    });
});
