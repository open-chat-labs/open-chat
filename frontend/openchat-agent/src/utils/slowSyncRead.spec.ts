import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { reportIfSlow, type SyncReadPhase } from "./slowSyncRead";

describe("reportIfSlow", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    // Invariant (#9757): a sync read still unanswered after the threshold is reported once, naming
    // the phase it is in, even if it never finishes
    test("a read that never finishes is reported once with the phase it stuck in", async () => {
        const reports: SyncReadPhase[] = [];

        void reportIfSlow(
            (setPhase) => {
                setPhase("waiting");
                return new Promise<never>(() => {});
            },
            (phase) => reports.push(phase),
            1000,
        );

        await vi.advanceTimersByTimeAsync(999);
        expect(reports).toEqual([]);
        await vi.advanceTimersByTimeAsync(1);
        expect(reports).toEqual(["waiting"]);
        await vi.advanceTimersByTimeAsync(10_000);
        expect(reports).toEqual(["waiting"]);
    });

    // Invariant (#9757): a sync read that answers within the threshold reports nothing, whether it
    // succeeds or fails
    test("a read that settles in time reports nothing and passes on its result", async () => {
        const reports: SyncReadPhase[] = [];
        const report = (phase: SyncReadPhase) => reports.push(phase);

        await expect(reportIfSlow(async () => "answer", report, 1000)).resolves.toBe("answer");
        await expect(
            reportIfSlow(() => Promise.reject(new Error("idb")), report, 1000),
        ).rejects.toThrow("idb");
        await vi.advanceTimersByTimeAsync(5000);

        expect(reports).toEqual([]);
    });
});
