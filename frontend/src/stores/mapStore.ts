import type { Writable } from "svelte/store";
import { get } from "svelte/store";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createMapStore<K, V>(store: Writable<Map<K, V>>) {
    return {
        subscribe: store.subscribe,
        set: store.set,
        insert: (key: K, value: V) => {
            store.update((map) => {
                map.set(key, value);
                return map;
            });
        },
        delete: (key: K): boolean => {
            if (get(store).has(key)) {
                store.update((map) => {
                    map.delete(key);
                    return map;
                });
                return true;
            }
            return false;
        },
        clear: (): void =>
            store.update((map) => {
                map.clear();
                return map;
            }),
    };
}
