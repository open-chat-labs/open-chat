import { type Subscriber, writable } from "svelte/store";

export function createLocalStorageStore(key: string, def: string) {
    const store = writable<string>(localStorage.getItem(key) || def);
    return {
        subscribe: (subscriber: Subscriber<string>, invalidate?: () => void) =>
            store.subscribe(subscriber, invalidate),
        set: (state: string): void => {
            store.set(state);
            localStorage.setItem(key, state);
        },
    };
}
