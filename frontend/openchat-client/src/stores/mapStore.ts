import type { Writable } from "svelte/store";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createMapStore<K, V>(store: Writable<Map<K, V>>) {
    let storeValue = new Map<K, V>();
    store.subscribe((v) => (storeValue = v));

    return {
        subscribe: store.subscribe,
        get: storeValue.get,
        has: storeValue.has,
        size: () => storeValue.size,
        set: store.set,
        insert: (key: K, value: V) => {
            store.update((map) => {
                map.set(key, value);
                return map;
            });
        },
        update: (updater: (value: Map<K, V>) => Map<K, V>) => {
            store.update(updater);
        },
        delete: (key: K): boolean => {
            if (storeValue.has(key)) {
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
