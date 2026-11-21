import type { Readable } from "svelte/store";
import { offlineStore } from "../stores/network";

/**
 * Calls `fn` once the app is online: straight away if it is, otherwise as soon as it comes back.
 * Returns a function which cancels the call if it hasn't happened yet.
 */
export function whenOnline(fn: () => void, offline: Readable<boolean> = offlineStore): () => void {
    let done = false;
    let onlineAlready = false;
    let unsubscribe: (() => void) | undefined = undefined;
    // Unsubscribes before calling `fn`, so that a throwing `fn` can't leave the subscription behind
    const fire = () => {
        if (done) return;
        done = true;
        unsubscribe?.();
        fn();
    };
    unsubscribe = offline.subscribe((isOffline) => {
        if (isOffline) return;
        // The first call comes before `subscribe` has returned: wait for it to
        if (unsubscribe === undefined) {
            onlineAlready = true;
        } else {
            fire();
        }
    });
    if (onlineAlready) fire();
    return () => {
        if (done) return;
        done = true;
        unsubscribe?.();
    };
}

function abortError(signal: AbortSignal): unknown {
    return signal.reason ?? new DOMException("Aborted", "AbortError");
}

function untilOnline(offline: Readable<boolean>, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(abortError(signal));
        const onAbort = () => {
            cancel();
            reject(abortError(signal!));
        };
        const cancel = whenOnline(() => {
            signal?.removeEventListener("abort", onAbort);
            resolve();
        }, offline);
        signal?.addEventListener("abort", onAbort, { once: true });
    });
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(abortError(signal));
        const onAbort = () => {
            clearTimeout(timer);
            reject(abortError(signal!));
        };
        const timer = setTimeout(() => {
            signal?.removeEventListener("abort", onAbort);
            resolve();
        }, ms);
        signal?.addEventListener("abort", onAbort, { once: true });
    });
}

// The waits after each failed attempt of `runWhenOnline`'s task, before it waits to be online and
// tries again. Its attempts are one more than there are waits.
export const RUN_WHEN_ONLINE_RETRY_DELAYS_MS = [2_000, 5_000, 10_000, 30_000, 60_000];

export type RunWhenOnlineOptions = {
    // Stops the waiting (and the retries) and rejects with the signal's reason
    signal?: AbortSignal;
    offline?: Readable<boolean>;
};

/**
 * Runs `task` once the app is online. A failed attempt is tried again after a backoff
 * (`RUN_WHEN_ONLINE_RETRY_DELAYS_MS`), each time once the app is online, and the last failure is
 * passed on. Whether the app was offline when an attempt failed isn't asked: the store can still
 * say online for a while after the connection has gone. For one-off background calls (registering
 * a push token, say) which would otherwise fail while offline and not be made again.
 */
export async function runWhenOnline<T>(
    task: () => Promise<T>,
    { signal, offline = offlineStore }: RunWhenOnlineOptions = {},
): Promise<T> {
    for (let attempt = 0; ; attempt++) {
        await untilOnline(offline, signal);
        try {
            return await task();
        } catch (err) {
            if (signal?.aborted) throw abortError(signal);
            if (attempt >= RUN_WHEN_ONLINE_RETRY_DELAYS_MS.length) throw err;
            console.debug("runWhenOnline: attempt failed, trying again", err);
            await sleep(RUN_WHEN_ONLINE_RETRY_DELAYS_MS[attempt], signal);
        }
    }
}

// By name: a signal's default reason may come from another realm's `DOMException`
export function isAbortError(err: unknown): boolean {
    return typeof err === "object" && err !== null && "name" in err && err.name === "AbortError";
}

// The waits before each attempt to get back a connection which dropped while online. The first is
// straight away, as it always was; the last repeats.
export const RECONNECT_DELAYS_MS = [0, 1_000, 2_000, 5_000, 10_000, 30_000, 60_000];

/** The wait before reconnect attempt `attempt` (0 for the first) */
export function reconnectDelay(attempt: number): number {
    return RECONNECT_DELAYS_MS[Math.min(Math.max(0, attempt), RECONNECT_DELAYS_MS.length - 1)];
}
