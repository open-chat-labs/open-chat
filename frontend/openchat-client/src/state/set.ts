import { SafeSet, type Primitive, type ReadonlySet } from "openchat-shared";
import { SvelteSet } from "svelte/reactivity";
import { scheduleUndo, type UndoLocalUpdate } from "./undo";

/**
 * This allows us to capture local updates that have been applied to server state held in a Set
 */
export class LocalSet<T> {
    #added: SafeSet<T>;
    #removed: SafeSet<T>;

    constructor(serialiser?: (x: T) => Primitive, deserialiser?: (x: Primitive) => T) {
        this.#added = new SafeSet(serialiser, deserialiser, () => new SvelteSet());
        this.#removed = new SafeSet(serialiser, deserialiser, () => new SvelteSet());
    }

    get added(): ReadonlySet<T> {
        return this.#added;
    }

    get removed(): ReadonlySet<T> {
        return this.#removed;
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

    apply(original: ReadonlySet<T>): Set<T> {
        const merged = new Set<T>(original);
        this.#added.forEach((t) => merged.add(t));
        this.#removed.forEach((t) => merged.delete(t));
        return merged;
    }
}
