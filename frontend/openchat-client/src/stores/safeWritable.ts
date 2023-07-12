/**
 * This is sveltes equality check
 *
 * function safe_not_equal(a, b) {
 *     return a != a ? b == b : a !== b || (a && typeof a === "object") || typeof a === "function";
 * }
 *
 * It means that if we store objects in a writable store then store.update(val => val) will
 * *always* trigger the subscribers which is quite possibly not what we want
 *
 * This writable wrapper will allow us to provide our own equality function
 */

import { Updater, Writable, writable } from "svelte/store";

function referenceEqual<T>(a: T, b: T): boolean {
    return a === b;
}

export function safeWritable<T>(
    val: T,
    eq: (a: T, b: T) => boolean = referenceEqual<T>
): Writable<T> {
    const store = writable(val);
    let currentValue = val;
    store.subscribe((v) => {
        currentValue = v;
    });
    function set(proposed: T): void {
        if (!eq(proposed, currentValue)) {
            store.set(proposed);
        } else {
            console.debug(
                "UI: STORE: ignorin  store update because currentValue is 'equal' to proposed value",
                currentValue,
                proposed
            );
        }
    }
    function update(fn: Updater<T>): void {
        set(fn(currentValue));
    }
    return {
        subscribe: store.subscribe,
        set,
        update,
    };
}
