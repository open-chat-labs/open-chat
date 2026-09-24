// For tests only. An in memory stand-in for an idb database, holding a map per store, which covers
// the parts of the idb api the caches use: reads and writes on a transaction's stores, and the
// single-operation `get` / `put` shortcuts on the database.
export function fakeIdb(initial: Record<string, Record<string, unknown>> = {}) {
    const stores = new Map<string, Map<string, unknown>>(
        Object.entries(initial).map(([name, values]) => [name, new Map(Object.entries(values))]),
    );
    const storeFor = (name: string) => {
        let store = stores.get(name);
        if (store === undefined) {
            store = new Map();
            stores.set(name, store);
        }
        return store;
    };
    const objectStore = (name: string) => {
        const store = storeFor(name);
        return {
            get: (key: string) => Promise.resolve(store.get(key)),
            put: (value: unknown, key: string) => {
                store.set(key, value);
                return Promise.resolve(key);
            },
            delete: (key: string) => {
                store.delete(key);
                return Promise.resolve();
            },
        };
    };
    const db = {
        transaction: (_storeNames: string | string[], _mode: string, _options?: unknown) => ({
            objectStore,
            done: Promise.resolve(),
        }),
        get: (name: string, key: string) => objectStore(name).get(key),
        put: (name: string, value: unknown, key: string) => objectStore(name).put(value, key),
    };
    return { db, stores };
}
