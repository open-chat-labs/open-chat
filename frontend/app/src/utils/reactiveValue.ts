import { createSubscriber } from "svelte/reactivity";

/**
 * Returns a function giving `store`'s current value which, called inside a $derived, $effect or
 * template, re-runs it when the store changes. A store's `.value` alone is a snapshot. The store is
 * only subscribed to while something reactive is reading it, so there is nothing to clean up.
 */
export function reactiveValue<T>(store: {
    readonly value: T;
    subscribe: (run: (value: T) => void) => () => void;
}): () => T {
    const subscribe = createSubscriber((update) => {
        // The store emits on subscribe, which is skipped
        let first = true;
        return store.subscribe(() => (first ? (first = false) : update()));
    });
    return () => {
        subscribe();
        return store.value;
    };
}
