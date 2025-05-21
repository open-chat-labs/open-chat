import type { SafeMap } from "openchat-shared";
import type { Writable } from "svelte/store";
import type { LocalMap } from "./map";
import type { LocalSet } from "./set";
import { scheduleUndo, type UndoLocalUpdate } from "./undo";

const noop = () => {};
export const notEq = (_a: unknown, _b: unknown) => false;

export function modifyWritable<T>(
    fn: (data: T) => UndoLocalUpdate,
    store: Writable<T>,
    timeout?: number,
) {
    let undo: UndoLocalUpdate = noop;
    store.update((data) => {
        undo = fn(data);
        return data;
    });
    return scheduleUndo(() => {
        store.update((s) => {
            undo();
            return s;
        });
    }, timeout);
}

export function removeFromWritableLocalMap<K, V>(
    key: K,
    store: Writable<LocalMap<K, V>>,
    timeout?: number,
) {
    return modifyWritable((d) => d.remove(key), store, timeout);
}

export function addToWritableLocalMap<K, V>(
    key: K,
    val: V,
    store: Writable<LocalMap<K, V>>,
    timeout?: number,
) {
    return modifyWritable((d) => d.addOrUpdate(key, val), store, timeout);
}

export function addToWritableLocalSet<V>(val: V, store: Writable<LocalSet<V>>, timeout?: number) {
    return modifyWritable((d) => d.add(val), store, timeout);
}

export function removeFromWritableLocalSet<V>(
    val: V,
    store: Writable<LocalSet<V>>,
    timeout?: number,
) {
    return modifyWritable((d) => d.remove(val), store, timeout);
}

export function addToWritableMap<K, V>(
    key: K,
    val: V,
    store: Writable<SafeMap<K, V>>,
    timeout?: number,
) {
    return modifyWritable(
        (d) => {
            d.set(key, val);
            return () => d.delete(key);
        },
        store,
        timeout,
    );
}

export function modifyWritableMap<K, V>(
    key: K,
    fn: (val: V) => (v: V) => V,
    store: Writable<SafeMap<K, V>>,
    notFound: () => V,
    timeout?: number,
) {
    return modifyWritable(
        (d) => {
            let state = d.get(key);
            if (state === undefined) {
                state = notFound();
                d.set(key, state);
            }
            const undo = fn(state);
            return () => {
                d.set(key, undo(state));
            };
        },
        store,
        timeout,
    );
}

export function removeFromWritableMap<K, V>(
    key: K,
    store: Writable<SafeMap<K, V>>,
    timeout?: number,
) {
    return modifyWritable(
        (d) => {
            const prev = d.get(key);
            d.delete(key);
            return () => {
                if (prev !== undefined) {
                    d.set(key, prev);
                }
            };
        },
        store,
        timeout,
    );
}
