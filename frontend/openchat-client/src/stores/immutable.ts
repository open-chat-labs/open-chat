import { type Subscriber, type Updater, type Writable, writable } from "svelte/store";
import { deepFreeze } from "../utils/object";

export function immutableStore<T>(val: T): Writable<T> {
    const store = writable(deepFreeze(val));
    return {
        subscribe: (subscriber: Subscriber<T>, invalidate?: () => void) => store.subscribe(subscriber, invalidate),
        set: (val: T) => store.set(deepFreeze(val)),
        update: (fn: Updater<T>) => store.update((val: T) => deepFreeze(fn(val))),
    };
}
