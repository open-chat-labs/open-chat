import { dequal } from "dequal";
import { writable } from "../utils/stores";
import { notEq } from "../state/utils";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createSetStore<T>(initialValue = new Set<T>()) {
    let storeValue = initialValue;
    const store = writable(initialValue, undefined, notEq);
    store.subscribe((value) => (storeValue = value));

    return {
        subscribe: store.subscribe,
        set: (s: Set<T>) => {
            if (!dequal(s, storeValue)) {
                store.set(s);
            }
        },
        add: (id: T): boolean => {
            if (!storeValue.has(id)) {
                store.update((ids) => {
                    ids.add(id);
                    return new Set(ids);
                });
                return true;
            }
            return false;
        },
        addMany: (newIds: T[]) => {
            const toAdd = newIds.filter((id) => !storeValue.has(id));
            if (toAdd.length > 0) {
                store.update((ids) => {
                    for (const id of toAdd) {
                        ids.add(id);
                    }
                    return new Set(ids);
                });
            }
        },
        delete: (id: T): boolean => {
            if (storeValue.has(id)) {
                store.update((ids) => {
                    ids.delete(id);
                    return new Set(ids);
                });
                return true;
            }
            return false;
        },
        deleteMany: (ids: T[]) => {
            const toDelete = ids.filter((id) => storeValue.has(id));
            if (toDelete.length > 0) {
                store.update((ids) => {
                    for (const id of toDelete) {
                        ids.delete(id);
                    }
                    return new Set(ids);
                });
            }
        },
        clear: (): void =>
            store.update((ids) => {
                ids.clear();
                return ids;
            }),
        get value(): Set<T> { return storeValue },
    };
}
