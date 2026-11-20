import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
    OFFLINE_HIDE_AFTER_MS,
    OFFLINE_SHOW_AFTER_MS,
    OfflineIndicator,
    type OfflineSource,
} from "./offlineIndicator.svelte";

// a store of the online state, as `offlineStore`
function source(initial: boolean): OfflineSource & { set(offline: boolean): void } {
    let value = initial;
    const runs = new Set<(offline: boolean) => void>();
    return {
        subscribe(run) {
            runs.add(run);
            run(value);
            return () => runs.delete(run);
        },
        set(offline) {
            value = offline;
            runs.forEach((run) => run(offline));
        },
    };
}

describe("the offline indicator", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    test("hidden while online", () => {
        const indicator = new OfflineIndicator();
        indicator.offlineChanged(false);
        vi.advanceTimersByTime(OFFLINE_SHOW_AFTER_MS * 2);
        expect(indicator.shown).toBe(false);
    });

    test("shows at once when the app starts offline", () => {
        const indicator = new OfflineIndicator();
        indicator.offlineChanged(true);
        expect(indicator.shown).toBe(true);
    });

    test("shows once the app has stayed offline a moment", () => {
        const indicator = new OfflineIndicator();
        indicator.offlineChanged(false);
        indicator.offlineChanged(true);
        vi.advanceTimersByTime(OFFLINE_SHOW_AFTER_MS - 1);
        expect(indicator.shown).toBe(false);
        vi.advanceTimersByTime(1);
        expect(indicator.shown).toBe(true);
    });

    test("a moment offline doesn't show it", () => {
        const indicator = new OfflineIndicator();
        indicator.offlineChanged(false);
        indicator.offlineChanged(true);
        vi.advanceTimersByTime(OFFLINE_SHOW_AFTER_MS / 2);
        indicator.offlineChanged(false);
        vi.advanceTimersByTime(OFFLINE_SHOW_AFTER_MS * 2);
        expect(indicator.shown).toBe(false);
    });

    test("goes promptly once the app is back online", () => {
        const indicator = new OfflineIndicator();
        indicator.offlineChanged(true);
        indicator.offlineChanged(false);
        expect(indicator.shown).toBe(true);
        vi.advanceTimersByTime(OFFLINE_HIDE_AFTER_MS);
        expect(indicator.shown).toBe(false);
    });

    test("a moment back online doesn't hide it", () => {
        const indicator = new OfflineIndicator();
        indicator.offlineChanged(true);
        indicator.offlineChanged(false);
        vi.advanceTimersByTime(OFFLINE_HIDE_AFTER_MS / 2);
        indicator.offlineChanged(true);
        vi.advanceTimersByTime(OFFLINE_HIDE_AFTER_MS * 2);
        expect(indicator.shown).toBe(true);
    });

    test("follows a store until stopped", () => {
        const offline = source(false);
        const indicator = new OfflineIndicator();
        const stop = indicator.follow(offline);
        offline.set(true);
        vi.advanceTimersByTime(OFFLINE_SHOW_AFTER_MS);
        expect(indicator.shown).toBe(true);
        offline.set(false);
        stop();
        vi.advanceTimersByTime(OFFLINE_HIDE_AFTER_MS);
        // the pending hide went with it, and later changes aren't followed
        expect(indicator.shown).toBe(true);
        offline.set(true);
        offline.set(false);
        vi.advanceTimersByTime(OFFLINE_HIDE_AFTER_MS);
        expect(indicator.shown).toBe(true);
    });
});
