import { SvelteSet } from "svelte/reactivity";
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
