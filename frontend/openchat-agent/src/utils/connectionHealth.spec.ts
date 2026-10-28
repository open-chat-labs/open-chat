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

// Probes fail once the given results run out
function setup(probeResults: boolean[] = [], online = true) {
    const probe = vi.fn(async () => probeResults.shift() ?? false);
    const changes: boolean[] = [];
    const isOnline = vi.fn(() => online);
    const health = new ConnectionHealth(probe, (unusable) => changes.push(unusable), isOnline);
    return { health, probe, changes, isOnline };
}

// Probes answer only when the test says
function setupWithHeldProbe() {
    let answer: (ok: boolean) => void = () => {};
    const probe = vi.fn(() => new Promise<boolean>((resolve) => (answer = resolve)));
    const changes: boolean[] = [];
    const health = new ConnectionHealth(
        probe,
        (unusable) => changes.push(unusable),
        () => true,
    );
    return { health, probe, changes, answer: (ok: boolean) => answer(ok) };
}

// A query sent now fails, then time moves on far enough for the next failure to count separately.
// The clock is moved without running timers, so no probe goes out meanwhile.
function badQuery(health: ConnectionHealth) {
    health.bad(Date.now());
    vi.setSystemTime(Date.now() + BAD_QUERY_SPACING_MS);
}

function badQueriesToProbe(health: ConnectionHealth) {
    for (let i = 0; i < BAD_QUERIES_TO_UNUSABLE; i++) {
        badQuery(health);
    }
}

// Enough bad queries to have the connection probed, then lets the probe answer. The connection
// is unusable if the probe fails, which it does unless the test gave it a result.
async function makeUnusable(health: ConnectionHealth) {
    badQueriesToProbe(health);
    await vi.advanceTimersByTimeAsync(0);
}

describe("ConnectionHealth", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test("is unusable after enough bad queries in a row and a failed probe, and a good query resets the count", async () => {
        const { health, probe, changes } = setup();
        for (let i = 0; i < BAD_QUERIES_TO_UNUSABLE - 1; i++) {
            badQuery(health);
        }
        health.good(200);
        vi.setSystemTime(Date.now() + SLOW_QUERY_MS);
        for (let i = 0; i < BAD_QUERIES_TO_UNUSABLE - 1; i++) {
            badQuery(health);
        }
        expect(probe).not.toHaveBeenCalled();

        badQuery(health);
        expect(probe).toHaveBeenCalledTimes(1);
        expect(health.unusable).toBe(false);

        await vi.advanceTimersByTimeAsync(0);
        expect(health.unusable).toBe(true);
        expect(changes).toEqual([true]);
    });

    // Queries can fail or stall for reasons that have nothing to do with the connection, such as a
    // slow subnet, and going offline stops the app sending
    test("bad queries alone don't make it unusable if the probe gets through", async () => {
        const { health, probe, changes } = setup([true]);
        badQueriesToProbe(health);
        await vi.advanceTimersByTimeAsync(0);
        expect(probe).toHaveBeenCalledTimes(1);
        expect(health.unusable).toBe(false);
        expect(changes).toEqual([]);

        // the count starts again
        for (let i = 0; i < BAD_QUERIES_TO_UNUSABLE - 1; i++) {
            badQuery(health);
        }
        expect(probe).toHaveBeenCalledTimes(1);

        badQuery(health);
        await vi.advanceTimersByTimeAsync(0);
        expect(probe).toHaveBeenCalledTimes(2);
        expect(health.unusable).toBe(true);
    });

    test("sends one probe at a time to check the connection", () => {
        const { health, probe } = setupWithHeldProbe();
        badQueriesToProbe(health);
        badQueriesToProbe(health);
        expect(probe).toHaveBeenCalledTimes(1);
    });

    test("a good query, or the app being hidden, while the probe is out keeps it usable", async () => {
        const { health, changes, answer } = setupWithHeldProbe();
        badQueriesToProbe(health);
        health.good(200);
        answer(false);
        await vi.advanceTimersByTimeAsync(0);
        expect(health.unusable).toBe(false);

        // bad queries count again once responses have stopped arriving
        vi.setSystemTime(Date.now() + SLOW_QUERY_MS);
        badQueriesToProbe(health);
        health.setHidden(true);
        answer(false);
        await vi.advanceTimersByTimeAsync(0);
        expect(health.unusable).toBe(false);
        expect(changes).toEqual([]);
    });

    // Invariant 1: while unusable, a probe is always scheduled no more than 60s away, so a
    // working connection always clears it
    test("keeps probing an unusable connection, however many probes fail, until one succeeds", async () => {
        const failures = 20;
        const { health, probe, changes } = setup([...Array(failures).fill(false), true]);
        await makeUnusable(health);

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
        await makeUnusable(health);
        const before = probe.mock.calls.length;
        await vi.advanceTimersByTimeAsync(10 * 60_000);
        // 5s, 10s, 20s, 40s, then every 60s: 4 probes in the first 75s, then one a minute
        const probes = probe.mock.calls.length - before;
        expect(probes).toBeLessThanOrEqual(4 + 10);
        expect(probes).toBeGreaterThanOrEqual(10);
    });

    // Invariant 1, with the browser reporting no network: the schedule keeps going without the
    // `online` event, and probes once the browser is online again
    test("keeps the probe schedule while the browser reports no network", async () => {
        const { health, probe, isOnline } = setup([true], false);
        await makeUnusable(health);
        expect(health.unusable).toBe(true);
        await vi.advanceTimersByTimeAsync(LONGEST_PROBE_INTERVAL_MS * 5);
        expect(probe).not.toHaveBeenCalled();

        isOnline.mockReturnValue(true);
        await vi.advanceTimersByTimeAsync(LONGEST_PROBE_INTERVAL_MS);
        expect(probe).toHaveBeenCalledTimes(1);
        expect(health.unusable).toBe(false);
    });

    test("a fast query clears an unusable connection, a slow success doesn't", async () => {
        const { health } = setup();
        await makeUnusable(health);
        health.good(FAST_RESPONSE_MS + 1);
        expect(health.unusable).toBe(true);
        health.good(FAST_RESPONSE_MS);
        expect(health.unusable).toBe(false);
    });

    test("a possible connection change probes an unusable connection straight away", async () => {
        const { health, probe } = setup([false, true]);
        await makeUnusable(health);
        health.connectionMayHaveChanged();
        await vi.advanceTimersByTimeAsync(0);
        expect(probe).toHaveBeenCalledTimes(2);
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
        expect(probe).not.toHaveBeenCalled();

        // and none once it has recovered
        await makeUnusable(health);
        health.good(200);
        const probes = probe.mock.calls.length;
        await vi.advanceTimersByTimeAsync(LONGEST_PROBE_INTERVAL_MS * 5);
        expect(probe).toHaveBeenCalledTimes(probes);
    });

    test("queries failing together count as one bad query", async () => {
        const { health } = setup();
        for (let i = 0; i < BAD_QUERIES_TO_UNUSABLE * 3; i++) {
            health.bad(Date.now());
        }
        await vi.advanceTimersByTimeAsync(0);
        expect(health.unusable).toBe(false);

        await makeUnusable(health);
        expect(health.unusable).toBe(true);
    });

    // The OS may cut a hidden app's network, or let its connections die, while the network itself
    // is fine. That used to have the app say it was offline for a moment each time it came back.
    test("failures while hidden, or of queries sent before coming back, don't count", async () => {
        const { health, probe, changes } = setup();
        health.setHidden(true);
        const sentWhileHidden = Date.now();
        await makeUnusable(health);
        expect(health.unusable).toBe(false);

        health.setHidden(false);
        for (let i = 0; i < BAD_QUERIES_TO_UNUSABLE; i++) {
            health.bad(sentWhileHidden);
            vi.setSystemTime(Date.now() + BAD_QUERY_SPACING_MS);
        }
        await vi.advanceTimersByTimeAsync(0);
        expect(probe).not.toHaveBeenCalled();
        expect(health.unusable).toBe(false);

        // queries sent since coming back count as usual
        await makeUnusable(health);
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
        const { health, probe } = setup([false, true]);
        await makeUnusable(health);
        health.setHidden(true);
        health.setHidden(false);
        await vi.advanceTimersByTimeAsync(0);
        expect(probe).toHaveBeenCalledTimes(2);
        expect(health.unusable).toBe(false);
    });

    // A burst of queries queues in the browser, so the last of them can pass SLOW_QUERY_MS on a
    // connection that is busy rather than dead
    test("bad queries don't count while responses are still arriving", async () => {
        const { health, probe } = setup();
        for (let i = 0; i < BAD_QUERIES_TO_UNUSABLE * 3; i++) {
            health.good(SLOW_QUERY_MS * 2);
            badQuery(health);
        }
        expect(probe).not.toHaveBeenCalled();
        expect(health.unusable).toBe(false);

        // once responses stop, they count again
        vi.setSystemTime(Date.now() + SLOW_QUERY_MS);
        await makeUnusable(health);
        expect(health.unusable).toBe(true);
    });
});
