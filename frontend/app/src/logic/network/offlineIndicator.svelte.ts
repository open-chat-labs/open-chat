// The offline indicator of the new trees (#10564): the native shell's strip and the web UI's
// banner. It follows the app's one online state, the client's `offlineStore` (the browser's
// online/offline events, or the worker's queries finding the connection unusable), and only
// smooths it: a blip of either way doesn't show or hide it. Each tree renders it in its own look.

import { offlineStore } from "@client";
import { onMount } from "svelte";

/** A store of whether the app is offline, as `offlineStore`. */
export type OfflineSource = { subscribe(run: (offline: boolean) => void): () => void };

// How long the app has to stay offline before the indicator shows, so a moment's loss (a query
// timing out as the network changes) doesn't flash it; offline on the first reading (a cold
// start with no network) shows it at once
export const OFFLINE_SHOW_AFTER_MS = 1500;
// How long it has to stay back online before the indicator goes, so a connection that comes and
// goes doesn't flicker it; short, so it goes promptly once the connection is back
export const OFFLINE_HIDE_AFTER_MS = 500;

/**
 * The indicator for a component that shows it, following `offlineStore` while the component is
 * mounted. Call it while the component initialises.
 */
export function useOfflineIndicator(): OfflineIndicator {
    const indicator = new OfflineIndicator();
    onMount(() => indicator.follow(offlineStore));
    return indicator;
}

export class OfflineIndicator {
    #shown = $state(false);
    #first = true;
    #timer: ReturnType<typeof setTimeout> | undefined;
    #showAfterMs: number;
    #hideAfterMs: number;

    constructor(showAfterMs = OFFLINE_SHOW_AFTER_MS, hideAfterMs = OFFLINE_HIDE_AFTER_MS) {
        this.#showAfterMs = showAfterMs;
        this.#hideAfterMs = hideAfterMs;
    }

    /** Whether the indicator shows. */
    get shown(): boolean {
        return this.#shown;
    }

    /** The app's online state changed (or was first read). */
    offlineChanged(offline: boolean): void {
        const first = this.#first;
        this.#first = false;
        this.#cancel();
        if (offline === this.#shown) return;
        if (offline && first) {
            this.#shown = true;
            return;
        }
        this.#timer = setTimeout(
            () => {
                this.#timer = undefined;
                this.#shown = offline;
            },
            offline ? this.#showAfterMs : this.#hideAfterMs,
        );
    }

    /** Follows `source` until the returned function is called, which stops it for good. */
    follow(source: OfflineSource): () => void {
        const unsubscribe = source.subscribe((offline) => this.offlineChanged(offline));
        return () => {
            unsubscribe();
            this.destroy();
        };
    }

    destroy(): void {
        this.#cancel();
    }

    #cancel(): void {
        if (this.#timer !== undefined) {
            clearTimeout(this.#timer);
            this.#timer = undefined;
        }
    }
}
