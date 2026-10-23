import { vi } from "vitest";
import {
    BAD_QUERIES_TO_UNUSABLE,
    ConnectionHealth,
    FAST_RESPONSE_MS,
    PROBE_INTERVALS_MS,
} from "./connectionHealth";

const LONGEST_PROBE_INTERVAL_MS = Math.max(...PROBE_INTERVALS_MS);

function setup(probeResults: boolean[] = [], online = true) {
    const probe = vi.fn(async () => probeResults.shift() ?? false);
    const changes: boolean[] = [];
    const isOnline = vi.fn(() => online);
    const health = new ConnectionHealth(probe, (unusable) => changes.push(unusable), isOnline);
    return { health, probe, changes, isOnline };
}

function makeUnusable(health: ConnectionHealth) {
    for (let i = 0; i < BAD_QUERIES_TO_UNUSABLE; i++) {
        health.bad();
    }
}

describe("ConnectionHealth", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test("is unusable after enough bad queries in a row, and a good one resets the count", () => {
        const { health, changes } = setup();
        for (let i = 0; i < BAD_QUERIES_TO_UNUSABLE - 1; i++) {
            health.bad();
        }
        health.good(200);
        for (let i = 0; i < BAD_QUERIES_TO_UNUSABLE - 1; i++) {
            health.bad();
        }
        expect(health.unusable).toBe(false);

        health.bad();
        expect(health.unusable).toBe(true);
        expect(changes).toEqual([true]);
    });

    // Invariant 1: while unusable, a probe is always scheduled no more than 60s away, so a
    // working connection always clears it
    test("keeps probing an unusable connection, however many probes fail, until one succeeds", async () => {
        const failures = 20;
        const { health, probe, changes } = setup([...Array(failures).fill(false), true]);
        makeUnusable(health);

        // every window of the longest interval sees at least one probe, until one succeeds
        while (health.unusable) {
            const before = probe.mock.calls.length;
            await vi.advanceTimersByTimeAsync(LONGEST_PROBE_INTERVAL_MS);
            expect(probe.mock.calls.length).toBeGreaterThan(before);
        }

        expect(probe).toHaveBeenCalledTimes(failures + 1);
        expect(health.unusable).toBe(false);
        expect(changes).toEqual([true, false]);
    });

    // Invariant 1, with the browser reporting no network: the schedule keeps going without the
    // `online` event, and probes once the browser is online again
    test("keeps the probe schedule while the browser reports no network", async () => {
        const { health, probe, isOnline } = setup([true], false);
        makeUnusable(health);
        await vi.advanceTimersByTimeAsync(LONGEST_PROBE_INTERVAL_MS * 5);
        expect(probe).not.toHaveBeenCalled();

        isOnline.mockReturnValue(true);
        await vi.advanceTimersByTimeAsync(LONGEST_PROBE_INTERVAL_MS);
        expect(probe).toHaveBeenCalledTimes(1);
        expect(health.unusable).toBe(false);
    });

    test("a fast query clears an unusable connection, a slow success doesn't", () => {
        const { health } = setup();
        makeUnusable(health);
        health.good(FAST_RESPONSE_MS + 1);
        expect(health.unusable).toBe(true);
        health.good(FAST_RESPONSE_MS);
        expect(health.unusable).toBe(false);
    });

    test("a possible connection change probes an unusable connection straight away", async () => {
        const { health, probe } = setup([true]);
        makeUnusable(health);
        health.connectionMayHaveChanged();
        await vi.advanceTimersByTimeAsync(0);
        expect(probe).toHaveBeenCalledTimes(1);
        expect(health.unusable).toBe(false);
    });

    // Invariant 2: a healthy connection sends no probe
    test("never probes a healthy connection", async () => {
        const { health, probe } = setup();
        for (let i = 0; i < 10; i++) {
            for (let j = 0; j < BAD_QUERIES_TO_UNUSABLE - 1; j++) {
                health.bad();
            }
            health.good(200);
            health.connectionMayHaveChanged();
            await vi.advanceTimersByTimeAsync(LONGEST_PROBE_INTERVAL_MS);
        }

        // and none once it has recovered
        makeUnusable(health);
        health.good(200);
        await vi.advanceTimersByTimeAsync(LONGEST_PROBE_INTERVAL_MS * 5);

        expect(probe).not.toHaveBeenCalled();
    });
});
