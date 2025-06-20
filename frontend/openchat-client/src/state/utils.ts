import { NOOP, type SafeMap } from "openchat-shared";
import type { Writable } from "svelte/store";
import type { LocalMap } from "./map";
import type { LocalSet } from "./set";
import { scheduleUndo, type UndoLocalUpdate } from "./undo";

export const notEq = (_a: unknown, _b: unknown) => false;
export function eqIfEmpty<T extends { length: number }>(a: T, b: T): boolean {
    return a.length === 0 && b.length === 0;
}
export function eqIfUndefined<T>(a: T | undefined, b: T | undefined): boolean {
    return a === undefined && b === undefined;
}

type UndoTimeout = number | "never";

export function modifyWritable<T>(
    fn: (data: T) => UndoLocalUpdate,
    store: Writable<T>,
    dedupeId?: string,
    timeout?: UndoTimeout,
) {
    let undo: UndoLocalUpdate = NOOP;
    store.update((data) => {
        undo = fn(data);
        return data;
    });
    return scheduleUndo(() => {
        store.update((s) => {
            undo();
            return s;
        });
    }, dedupeId, timeout);
}

export function removeFromWritableLocalMap<K, V>(
    key: K,
    store: Writable<LocalMap<K, V>>,
    timeout?: UndoTimeout,
) {
    return modifyWritable((d) => d.remove(key), store, undefined, timeout);
}

export function addToWritableLocalMap<K, V>(
    key: K,
    val: V,
    store: Writable<LocalMap<K, V>>,
    timeout?: UndoTimeout,
) {
    return modifyWritable((d) => d.addOrUpdate(key, val), store, undefined, timeout);
}

export function addToWritableLocalSet<V>(val: V, store: Writable<LocalSet<V>>, timeout?: number) {
    return modifyWritable((d) => d.add(val), store, undefined, timeout);
}

export function removeFromWritableLocalSet<V>(
    val: V,
    store: Writable<LocalSet<V>>,
    timeout?: UndoTimeout,
) {
    return modifyWritable((d) => d.remove(val), store, undefined, timeout);
}

export function addToWritableMap<K, V>(
    key: K,
    val: V,
    store: Writable<SafeMap<K, V>>,
    timeout?: UndoTimeout,
) {
    return modifyWritable(
        (d) => {
            d.set(key, val);
            return () => d.delete(key);
        },
        store,
        undefined,
        timeout,
    );
}

export function modifyWritableMap<K, V>(
    key: K,
    fn: (val: V) => (v: V) => V,
    store: Writable<SafeMap<K, V>>,
    notFound: () => V,
    dedupeId?: string,
    timeout?: UndoTimeout,
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
        dedupeId,
        timeout,
    );
}

export function removeFromWritableMap<K, V>(
    key: K,
    store: Writable<SafeMap<K, V>>,
    timeout?: UndoTimeout,
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
        undefined,
        timeout,
    );
}
