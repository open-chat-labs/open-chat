import type { Primitive } from "openchat-shared";
import { SvelteMap, SvelteSet } from "svelte/reactivity";
import { scheduleUndo, type UndoLocalUpdate } from "./undo";

export interface ReadonlySet<T> {
    has(item: T): boolean;
    get size(): number;
    [Symbol.iterator](): Iterator<T>;
    values(): IterableIterator<T>;
    keys(): IterableIterator<T>;
    entries(): IterableIterator<[T, T]>;
    forEach(callback: (value: T, value2: T, set: ReadonlySet<T>) => void): void;
}

/**
 * This allows us to capture local updates that have been applied to server state held in a Set
 */
export class LocalSet<T> {
    #added: ReactiveSafeSet<T>;
    #removed: ReactiveSafeSet<T>;

    constructor(serialiser: (thing: T) => Primitive) {
        this.#added = new ReactiveSafeSet(serialiser);
        this.#removed = new ReactiveSafeSet(serialiser);
    }

    // for testing
    protected added(thing: T): boolean {
        return this.#added.has(thing);
    }

    // for testing
    protected removed(thing: T): boolean {
        return this.#removed.has(thing);
    }

    add(thing: T): UndoLocalUpdate {
        this.#added.add(thing);
        const removed = this.#removed.delete(thing);
        return scheduleUndo(() => {
            this.#added.delete(thing);
            if (removed) {
                this.#removed.add(thing);
            }
        });
    }

    remove(thing: T) {
        this.#removed.add(thing);
        const removed = this.#added.delete(thing);
        return scheduleUndo(() => {
            this.#removed.delete(thing);
            if (removed) {
                this.#added.add(thing);
            }
        });
    }

    apply(original: Set<T>): Set<T> {
        const merged = new Set<T>(original);
        this.#added.forEach((t) => merged.add(t));
        this.#removed.forEach((t) => merged.delete(t));
        return merged;
    }
}

export class ReactiveSafeSet<K> {
    #set = new SvelteSet<Primitive>();
    #valueMap = new SvelteMap<Primitive, K>();

    constructor(private _serialize: (value: K) => Primitive) {}

    add(value: K): this {
        const svalue = this._serialize(value);
        this.#set.add(svalue);
        this.#valueMap.set(svalue, value);
        return this;
    }

    has(key: K): boolean {
        return this.#set.has(this._serialize(key));
    }

    delete(key: K): boolean {
        const svalue = this._serialize(key);
        this.#valueMap.delete(svalue);
        return this.#set.delete(svalue);
    }

    clear(): void {
        this.#set.clear();
        this.#valueMap.clear();
    }

    values(): IterableIterator<K> {
        return this.#valueMap.values();
    }

    keys(): IterableIterator<K> {
        return this.values();
    }

    entries(): IterableIterator<[K, K]> {
        const it = this.#valueMap.values();
        return {
            [Symbol.iterator]() {
                return this;
            },
            next(): IteratorResult<[K, K]> {
                const result = it.next();
                if (result.done) return { done: true, value: undefined };
                return { done: false, value: [result.value, result.value] };
            },
        };
    }

    forEach(callback: (value: K, value2: K, set: this) => void): void {
        for (const value of this.#valueMap.values()) {
            callback(value, value, this);
        }
    }

    get size(): number {
        return this.#set.size;
    }

    [Symbol.iterator](): Iterator<K> {
        return this.values();
    }
}
