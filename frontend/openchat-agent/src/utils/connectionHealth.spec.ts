import { vi } from "vitest";
import {
    BAD_QUERIES_TO_UNUSABLE,
    BAD_QUERY_SPACING_MS,
    ConnectionHealth,
    FAST_RESPONSE_MS,
    SLOW_QUERY_MS,
} from "./connectionHealth";

// The issue promises a probe at least this often while unusable
const LONGEST_PROBE_INTERVAL_MS = 60_000;

function setup(probeResults: boolean[] = [], online = true) {
    const probe = vi.fn(async () => probeResults.shift() ?? false);
    const changes: boolean[] = [];
    const isOnline = vi.fn(() => online);
    const health = new ConnectionHealth(probe, (unusable) => changes.push(unusable), isOnline);
    return { health, probe, changes, isOnline };
}

// A query sent now fails, then time moves on far enough for the next failure to count separately.
// The clock is moved without running timers, so no probe goes out meanwhile.
function badQuery(health: ConnectionHealth) {
    health.bad(Date.now());
    vi.setSystemTime(Date.now() + BAD_QUERY_SPACING_MS);
}

function makeUnusable(health: ConnectionHealth) {
    for (let i = 0; i < BAD_QUERIES_TO_UNUSABLE; i++) {
        badQuery(health);
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
            badQuery(health);
        }
        health.good(200);
        vi.setSystemTime(Date.now() + SLOW_QUERY_MS);
        for (let i = 0; i < BAD_QUERIES_TO_UNUSABLE - 1; i++) {
            badQuery(health);
        }
        expect(health.unusable).toBe(false);

        badQuery(health);
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

    // Probes cost traffic and battery on a bad connection, so they never come faster than the
    // backoff allows
    test("probes an unusable connection no more often than the backoff allows", async () => {
        const { health, probe } = setup();
        makeUnusable(health);
        await vi.advanceTimersByTimeAsync(10 * 60_000);
        // 5s, 10s, 20s, 40s, then every 60s: 4 probes in the first 75s, then one a minute
        expect(probe.mock.calls.length).toBeLessThanOrEqual(4 + 10);
        expect(probe.mock.calls.length).toBeGreaterThanOrEqual(10);
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
                badQuery(health);
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

    test("queries failing together count as one bad query", () => {
        const { health } = setup();
        for (let i = 0; i < BAD_QUERIES_TO_UNUSABLE * 3; i++) {
            health.bad(Date.now());
        }
        expect(health.unusable).toBe(false);

        makeUnusable(health);
        expect(health.unusable).toBe(true);
    });

    // The OS may cut a hidden app's network, or let its connections die, while the network itself
    // is fine. That used to have the app say it was offline for a moment each time it came back.
    test("failures while hidden, or of queries sent before coming back, don't count", () => {
        const { health, changes } = setup();
        health.setHidden(true);
        const sentWhileHidden = Date.now();
        makeUnusable(health);
        expect(health.unusable).toBe(false);

        health.setHidden(false);
        for (let i = 0; i < BAD_QUERIES_TO_UNUSABLE; i++) {
            health.bad(sentWhileHidden);
            vi.setSystemTime(Date.now() + BAD_QUERY_SPACING_MS);
        }
        expect(health.unusable).toBe(false);

        // queries sent since coming back count as usual
        makeUnusable(health);
        expect(health.unusable).toBe(true);
        expect(changes).toEqual([true]);
    });

    test("coming back forgets bad queries counted before the app was hidden", () => {
        const { health } = setup();
        for (let i = 0; i < BAD_QUERIES_TO_UNUSABLE - 1; i++) {
            badQuery(health);
        }
        health.setHidden(true);
        health.setHidden(false);
        badQuery(health);
        expect(health.unusable).toBe(false);
    });

    test("coming back probes an unusable connection straight away", async () => {
        const { health, probe } = setup([true]);
        makeUnusable(health);
        health.setHidden(true);
        health.setHidden(false);
        await vi.advanceTimersByTimeAsync(0);
        expect(probe).toHaveBeenCalledTimes(1);
        expect(health.unusable).toBe(false);
    });

    // A burst of queries queues in the browser, so the last of them can pass SLOW_QUERY_MS on a
    // connection that is busy rather than dead
    test("bad queries don't count while responses are still arriving", () => {
        const { health } = setup();
        for (let i = 0; i < BAD_QUERIES_TO_UNUSABLE * 3; i++) {
            health.good(SLOW_QUERY_MS * 2);
            badQuery(health);
        }
        expect(health.unusable).toBe(false);

        // once responses stop, they count again
        vi.setSystemTime(Date.now() + SLOW_QUERY_MS);
        makeUnusable(health);
        expect(health.unusable).toBe(true);
    });
});
