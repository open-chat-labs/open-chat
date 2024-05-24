import { writable } from "svelte/store";

export function createLocalStorageStore(key: string, def: string) {
    const store = writable<string>(localStorage.getItem(key) || def);
    return {
        subscribe: store.subscribe,
        set: (state: string): void => {
            store.set(state);
            localStorage.setItem(key, state);
        },
    };
}
