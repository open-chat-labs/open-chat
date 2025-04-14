import { SvelteSet } from "svelte/reactivity";
import { scheduleUndo, type UndoLocalUpdate } from "./undo";

export interface IReadonlySet<T> {
    has(item: T): boolean;
    get size(): number;
    [Symbol.iterator](): Iterator<T>;
    values(): IterableIterator<T>;
    keys(): IterableIterator<T>;
    entries(): IterableIterator<[T, T]>;
    forEach(callback: (value: T, value2: T, set: IReadonlySet<T>) => void): void;
}

/**
 * This is used for the ultimate result of merging server & local state since we want the set itself to be readonly
 * to prevent accidental mutation rather than just the property being readonly.
 */
export class ReadonlySet<T> implements IReadonlySet<T> {
    #set: Set<T>;
    constructor(s: Set<T>) {
        this.#set = s;
    }
    has(item: T): boolean {
        return this.#set.has(item);
    }
    get size() {
        return this.#set.size;
    }
    [Symbol.iterator](): Iterator<T> {
        return this.#set[Symbol.iterator]();
    }
    values(): IterableIterator<T> {
        return this.#set.values();
    }

    keys(): IterableIterator<T> {
        return this.#set.keys();
    }

    entries(): IterableIterator<[T, T]> {
        return this.#set.entries();
    }

    forEach(callback: (value: T, value2: T, set: ReadonlySet<T>) => void): void {
        this.#set.forEach((v) => callback(v, v, this));
    }
}

/**
 * This allows us to capture local updates that have been applied to server state held in a Set
 */
export class LocalSet<T> {
    #added = new SvelteSet<T>();
    #removed = new SvelteSet<T>();

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
