import { SvelteMap, SvelteSet } from "svelte/reactivity";
import { scheduleUndo, type UndoLocalUpdate } from "./undo";

export interface IReadonlyMap<K, V> {
    get(key: K): V | undefined;
    has(key: K): boolean;
    get size(): number;
    [Symbol.iterator](): Iterator<[K, V]>;
    entries(): IterableIterator<[K, V]>;
    keys(): IterableIterator<K>;
    values(): IterableIterator<V>;
    forEach(callback: (value: V, key: K, map: IReadonlyMap<K, V>) => void): void;
}

export class ReadonlyMap<K, V> implements Iterable<[K, V]> {
    #map: Map<K, V>;

    constructor(map: Map<K, V>) {
        this.#map = map;
    }

    get(key: K): V | undefined {
        return this.#map.get(key);
    }

    has(key: K): boolean {
        return this.#map.has(key);
    }

    get size(): number {
        return this.#map.size;
    }

    [Symbol.iterator](): Iterator<[K, V]> {
        return this.#map[Symbol.iterator]();
    }

    entries(): IterableIterator<[K, V]> {
        return this.#map.entries();
    }

    keys(): IterableIterator<K> {
        return this.#map.keys();
    }

    values(): IterableIterator<V> {
        return this.#map.values();
    }

    forEach(callback: (value: V, key: K, map: ReadonlyMap<K, V>) => void): void {
        this.#map.forEach((value, key) => callback(value, key, this));
    }
}

export class LocalMap<K, V> {
    #addedOrUpdated = new SvelteMap<K, V>();
    #removed = new SvelteSet<K>();

    // for testing
    protected addedOrUpdated(key: K): boolean {
        return this.#addedOrUpdated.has(key);
    }

    // for testing
    protected removed(key: K): boolean {
        return this.#removed.has(key);
    }

    addOrUpdate(key: K, value: V): UndoLocalUpdate {
        this.#addedOrUpdated.set(key, value);
        const removed = this.#removed.delete(key);
        return scheduleUndo(() => {
            this.#addedOrUpdated.delete(key);
            if (removed) {
                this.#removed.add(key);
            }
        });
    }

    remove(key: K) {
        this.#removed.add(key);
        const previous = this.#addedOrUpdated.get(key);
        this.#addedOrUpdated.delete(key);
        return scheduleUndo(() => {
            this.#removed.delete(key);
            if (previous) {
                this.#addedOrUpdated.set(key, previous);
            }
        });
    }

    apply(original: Map<K, V>): Map<K, V> {
        const merged = new Map<K, V>(original);
        this.#addedOrUpdated.forEach((v, k) => merged.set(k, v));
        this.#removed.forEach((k) => merged.delete(k));
        return merged;
    }
}
