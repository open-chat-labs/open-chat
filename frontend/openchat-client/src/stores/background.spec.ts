import { vi } from "vitest";
import { background } from "./background";

describe("background store", () => {
    test("tracks document.visibilityState and removes its listener when unsubscribed", () => {
        const addSpy = vi.spyOn(document, "addEventListener");
        const removeSpy = vi.spyOn(document, "removeEventListener");
        const visibility = vi.spyOn(document, "visibilityState", "get");
        visibility.mockReturnValue("visible");

        const values: boolean[] = [];
        const unsub = background.subscribe((v) => values.push(v));
        expect(values).toEqual([false]);

        visibility.mockReturnValue("hidden");
        document.dispatchEvent(new Event("visibilitychange"));
        expect(values).toEqual([false, true]);

        visibility.mockReturnValue("visible");
        document.dispatchEvent(new Event("visibilitychange"));
        expect(values).toEqual([false, true, false]);

        unsub();

        const added = addSpy.mock.calls.find((c) => c[0] === "visibilitychange");
        const removed = removeSpy.mock.calls.find((c) => c[0] === "visibilitychange");
        expect(added).toBeDefined();
        expect(removed).toBeDefined();
        expect(removed?.[1]).toBe(added?.[1]);

        // no longer listening
        visibility.mockReturnValue("hidden");
        document.dispatchEvent(new Event("visibilitychange"));
        expect(values).toEqual([false, true, false]);

        vi.restoreAllMocks();
    });
});
