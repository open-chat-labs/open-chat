import { CommunityMap, type CommunityIdentifier } from "openchat-shared";
import { SvelteMap, SvelteSet } from "svelte/reactivity";
import { scheduleUndo, type UndoLocalUpdate } from "./undo";

export interface ReadonlyMap<K, V> {
    get(key: K): V | undefined;
    has(key: K): boolean;
    get size(): number;
    [Symbol.iterator](): Iterator<[K, V]>;
    entries(): IterableIterator<[K, V]>;
    keys(): IterableIterator<K>;
    values(): IterableIterator<V>;
    forEach(callback: (value: V, key: K, map: ReadonlyMap<K, V>) => void): void;
}

export class LocalCommunityMap<V> {
    #addedOrUpdated = new SvelteMap<string, V>();
    #removed = new SvelteSet<string>();

    #key(id: CommunityIdentifier): string {
        return JSON.stringify(id);
    }

    #id(key: string): CommunityIdentifier {
        return JSON.parse(key);
    }

    // for testing
    protected addedOrUpdated(key: CommunityIdentifier): boolean {
        return this.#addedOrUpdated.has(this.#key(key));
    }

    // for testing
    protected removed(key: CommunityIdentifier): boolean {
        return this.#removed.has(this.#key(key));
    }

    addOrUpdate(key: CommunityIdentifier, value: V): UndoLocalUpdate {
        const keyStr = this.#key(key);
        this.#addedOrUpdated.set(keyStr, value);
        const removed = this.#removed.delete(keyStr);
        return scheduleUndo(() => {
            this.#addedOrUpdated.delete(keyStr);
            if (removed) {
                this.#removed.add(keyStr);
            }
        });
    }

    remove(key: CommunityIdentifier) {
        const keyStr = this.#key(key);
        this.#removed.add(keyStr);
        const previous = this.#addedOrUpdated.get(keyStr);
        this.#addedOrUpdated.delete(keyStr);
        return scheduleUndo(() => {
            this.#removed.delete(keyStr);
            if (previous) {
                this.#addedOrUpdated.set(keyStr, previous);
            }
        });
    }

    apply(original: CommunityMap<V>): CommunityMap<V> {
        const merged = original.clone();
        this.#addedOrUpdated.forEach((v, k) => merged.set(this.#id(k), v));
        this.#removed.forEach((k) => merged.delete(this.#id(k)));
        return merged;
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

    apply(original: ReadonlyMap<K, V>): ReadonlyMap<K, V> {
        const merged = new Map<K, V>(original);
        this.#addedOrUpdated.forEach((v, k) => merged.set(k, v));
        this.#removed.forEach((k) => merged.delete(k));
        return merged;
    }
}
