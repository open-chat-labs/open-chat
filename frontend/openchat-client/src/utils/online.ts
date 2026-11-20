import type { Readable } from "svelte/store";
import { offlineStore } from "../stores/network";

/**
 * Calls `fn` once the app is online: straight away if it is, otherwise as soon as it comes back.
 * Returns a function which cancels the call if it hasn't happened yet.
 */
export function whenOnline(fn: () => void, offline: Readable<boolean> = offlineStore): () => void {
    let done = false;
    let unsubscribe: (() => void) | undefined = undefined;
    unsubscribe = offline.subscribe((isOffline) => {
        if (isOffline || done) return;
        done = true;
        // undefined when already online: the first call comes before `subscribe` returns
        unsubscribe?.();
        fn();
    });
    if (done) unsubscribe();
    return () => {
        if (done) return;
        done = true;
        unsubscribe?.();
    };
}

function isOffline(offline: Readable<boolean>): boolean {
    let value = false;
    offline.subscribe((v) => (value = v))();
    return value;
}

/**
 * Runs `task` once the app is online, and again on the next reconnection if it fails because the
 * app went offline meanwhile. A failure while online is passed on. For one-off background calls
 * (registering a push token, say) which would otherwise fail while offline and never be made.
 */
export async function runWhenOnline<T>(
    task: () => Promise<T>,
    offline: Readable<boolean> = offlineStore,
): Promise<T> {
    for (;;) {
        await new Promise<void>((resolve) => whenOnline(resolve, offline));
        try {
            return await task();
        } catch (err) {
            if (!isOffline(offline)) throw err;
        }
    }
}

// The waits before each attempt to get back a connection which dropped while online. The last
// repeats.
export const RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 30_000, 60_000];

/** The wait before reconnect attempt `attempt` (0 for the first) */
export function reconnectDelay(attempt: number): number {
    return RECONNECT_DELAYS_MS[Math.min(Math.max(0, attempt), RECONNECT_DELAYS_MS.length - 1)];
}
