import type { Writable } from "svelte/store";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createSetStore<T>(store: Writable<Set<T>>) {
    return {
        subscribe: store.subscribe,
        add: (id: T): void =>
            store.update((ids) => {
                ids.add(id);
                return new Set(ids);
            }),
        delete: (id: T): void =>
            store.update((ids) => {
                ids.delete(id);
                return new Set(ids);
            }),
        clear: (): void =>
            store.update((ids) => {
                ids.clear();
                return ids;
            }),
    };
}
