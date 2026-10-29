import { setConnectionUnusable } from "@shared";

// A query whose response hasn't started arriving after this long counts against the connection.
// Well above a normal query (under a second) and a heavy composite one (several seconds), so that
// only a connection which is barely carrying anything trips it.
export const SLOW_QUERY_MS = 10_000;

// Bad queries in a row before the connection is treated as unusable. Any good one resets the count,
// and none counts while responses are still arriving: a connection carrying responses is usable,
// however slow or failed some queries are. A burst of queries (the first load, or catching up
// after a resume) queues in the browser, so the last of them can wait well past `SLOW_QUERY_MS`
// on a connection that is busy rather than dead, and those used to trip it.
export const BAD_QUERIES_TO_UNUSABLE = 3;

// Bad queries closer together than this count as one. A single blip, such as the network changing,
// fails every query in flight at once, and the app often has several out together, so counting
// each of them tripped the connection on one hiccup.
export const BAD_QUERY_SPACING_MS = 2_000;

// A response must start within this long to show that an unusable connection is working again.
// Stricter than `SLOW_QUERY_MS`, so that a connection on the edge doesn't flip back and forth.
export const FAST_RESPONSE_MS = 5_000;

// The waits between probes while the connection is unusable. The last repeats.
export const PROBE_INTERVALS_MS = [5_000, 10_000, 20_000, 40_000, 60_000];

export type QueryOutcomes = {
    // The query's response started arriving after `responseMs`
    good(responseMs: number): void;
    // The query sent at `sentAt` failed, or has waited `SLOW_QUERY_MS` without a response
    bad(sentAt: number): void;
};

/**
 * Whether the connection is usable, judged from how the app's own queries fare.
 *
 * The browser's estimates (`navigator.connection.downlink` and the like) aren't used: they come
 * from recent traffic, so once the app treats the connection as unusable and stops sending, they
 * stop changing and the app never recovers. Here, while the connection is unusable, a small probe
 * is sent with backoff until one gets a fast response. A healthy connection sends no probes.
 */
export class ConnectionHealth implements QueryOutcomes {
    #probe: () => Promise<boolean>;
    #onChange: (unusable: boolean) => void;
    #isOnline: () => boolean;
    #unusable = false;
    #badInARow = 0;
    #lastResponseAt = Number.NEGATIVE_INFINITY;
    #probeTimer: ReturnType<typeof setTimeout> | undefined;
    #probing = false;
    #probesFailed = 0;
    #lastBadAt = Number.NEGATIVE_INFINITY;
    // Queries sent before this went out on a connection that may since have gone, so their
    // failures say nothing about the current one
    #ignoreSentBefore = Number.NEGATIVE_INFINITY;
    #hidden = false;

    /**
     * @param probe resolves to true if a small request got a response within `FAST_RESPONSE_MS`.
     * Must resolve, never reject or hang
     * @param onChange called whenever the connection becomes unusable or usable again
     */
    constructor(
        probe: () => Promise<boolean>,
        onChange: (unusable: boolean) => void,
        isOnline: () => boolean = () => navigator.onLine,
    ) {
        this.#probe = probe;
        this.#onChange = onChange;
        this.#isOnline = isOnline;
    }

    get unusable(): boolean {
        return this.#unusable;
    }

    good(responseMs: number): void {
        this.#badInARow = 0;
        this.#lastResponseAt = Date.now();
        if (this.#unusable && responseMs <= FAST_RESPONSE_MS) {
            this.#setUnusable(false);
        }
    }

    bad(sentAt: number): void {
        // While the app is hidden the OS may cut its network access, or let its connections die,
        // even though the network is fine. Counting those failures had the app say it was offline
        // for a moment each time it came back.
        if (this.#hidden || sentAt < this.#ignoreSentBefore) return;
        const now = Date.now();
        if (now - this.#lastResponseAt < SLOW_QUERY_MS) return;
        if (now - this.#lastBadAt < BAD_QUERY_SPACING_MS) return;
        this.#lastBadAt = now;
        this.#badInARow += 1;
        if (!this.#unusable && this.#badInARow >= BAD_QUERIES_TO_UNUSABLE) {
            this.#setUnusable(true);
        }
    }

    /**
     * Something suggests the connection may have changed: the browser came back online, switched
     * network, or the app resumed. If the connection is unusable, probe now instead of waiting.
     */
    connectionMayHaveChanged(): void {
        if (this.#unusable && !this.#probing) {
            this.#probesFailed = 0;
            this.#scheduleProbe(0);
        }
    }

    /**
     * Whether the app is hidden. Bad queries aren't counted while it is, nor afterwards for
     * queries sent before it came back, since those may have been waiting on a connection that
     * died meanwhile.
     */
    setHidden(hidden: boolean): void {
        if (hidden === this.#hidden) return;
        this.#hidden = hidden;
        if (!hidden) {
            this.#badInARow = 0;
            this.#ignoreSentBefore = Date.now();
            this.connectionMayHaveChanged();
        }
    }

    #setUnusable(unusable: boolean) {
        this.#unusable = unusable;
        this.#badInARow = 0;
        this.#probesFailed = 0;
        if (unusable) {
            this.#scheduleProbe(PROBE_INTERVALS_MS[0]);
        } else {
            clearTimeout(this.#probeTimer);
            this.#probeTimer = undefined;
        }
        this.#onChange(unusable);
    }

    #scheduleProbe(delayMs: number) {
        clearTimeout(this.#probeTimer);
        this.#probeTimer = setTimeout(() => this.#runProbe(), delayMs);
    }

    async #runProbe() {
        this.#probeTimer = undefined;
        if (!this.#unusable) return;

        // With the browser reporting no network at all, a probe can't succeed. Keep the schedule
        // going anyway rather than relying on the `online` event to restart it.
        let ok = false;
        if (this.#isOnline()) {
            this.#probing = true;
            try {
                ok = await this.#probe();
            } catch {
                ok = false;
            } finally {
                this.#probing = false;
            }
        }

        // A fast query may have cleared it while the probe was out
        if (!this.#unusable) return;

        if (ok) {
            this.#setUnusable(false);
        } else {
            this.#probesFailed += 1;
            const index = Math.min(this.#probesFailed, PROBE_INTERVALS_MS.length - 1);
            this.#scheduleProbe(PROBE_INTERVALS_MS[index]);
        }
    }
}

// Resolves to whether the IC's status endpoint, a few hundred bytes, starts answering within
// `FAST_RESPONSE_MS`
async function probeStatus(icUrl: string): Promise<boolean> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FAST_RESPONSE_MS);
    try {
        const response = await fetch(new URL("/api/v2/status", icUrl), {
            cache: "no-store",
            signal: controller.signal,
        });
        return response.ok;
    } catch {
        return false;
    } finally {
        clearTimeout(timer);
    }
}

// The health of this context's connection. Nothing is recorded until `monitorConnection` is called.
let connectionHealth: ConnectionHealth | undefined;

export const queryOutcomes: QueryOutcomes = {
    good: (responseMs) => connectionHealth?.good(responseMs),
    bad: (sentAt) => connectionHealth?.bad(sentAt),
};

/**
 * Starts judging the connection from this context's queries. `offline()` in this context follows
 * the result, and `onChange` is told of every change so that it can be passed on.
 */
export function monitorConnection(icUrl: string, onChange: (unusable: boolean) => void): void {
    if (connectionHealth !== undefined) return;
    connectionHealth = new ConnectionHealth(
        () => probeStatus(icUrl),
        (unusable) => {
            setConnectionUnusable(unusable);
            onChange(unusable);
        },
    );
    connectionHealth.setHidden(appHidden);
}

export function connectionMayHaveChanged(): void {
    connectionHealth?.connectionMayHaveChanged();
}

// Recorded even before `monitorConnection` is called, so that monitoring starts in the right state
let appHidden = false;

export function setAppHidden(hidden: boolean): void {
    appHidden = hidden;
    connectionHealth?.setHidden(hidden);
}
