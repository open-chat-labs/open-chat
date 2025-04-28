import { writable } from "svelte/store";

/**
 * This may look pretty weird but there is method in the madness.
 * When migrating from svelte 4 to svelte 5 we often need to leave
 * behind a dummy store to react at the right moment when the
 * corresponding svelte 5 rune changes
 */
export function createDummyStore() {
    return writable<symbol>(Symbol());
}
