import type { Writable } from "svelte/store";
import { get } from "svelte/store";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createSetStore<T>(store: Writable<Set<T>>) {
    return {
        subscribe: store.subscribe,
        set: store.set,
        add: (id: T): boolean => {
            if (!get(store).has(id)) {
                store.update((ids) => {
                    ids.add(id);
                    return new Set(ids);
                });
                return true;
            }
            return false;
        },
        delete: (id: T): boolean => {
            if (get(store).has(id)) {
                store.update((ids) => {
                    ids.delete(id);
                    return new Set(ids);
                });
                return true;
            }
            return false;
        },
        clear: (): void =>
            store.update((ids) => {
                ids.clear();
                return ids;
            }),
    };
}
