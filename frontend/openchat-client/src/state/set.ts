import { defaultDeserialiser, defaultSerialiser, type Primitive } from "openchat-shared";
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
    #added: ReactiveSafeSet<T>;
    #removed: ReactiveSafeSet<T>;

    constructor(serialiser: (x: T) => Primitive = defaultSerialiser) {
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
    // #isPrimitive: boolean;
    #serialise: (key: K) => Primitive;
    #deserialise: (key: Primitive) => K;
    #set = new SvelteSet<Primitive>();

    constructor(serialiser?: (key: K) => Primitive, deserialiser?: (primitive: Primitive) => K) {
        // this.#isPrimitive = serialiser === undefined && deserialiser === undefined;
        this.#serialise = serialiser ?? defaultSerialiser;
        this.#deserialise = deserialiser ?? defaultDeserialiser;
    }

    add(value: K): this {
        const svalue = this.#serialise(value);
        this.#set.add(svalue);
        return this;
    }

    has(key: K): boolean {
        return this.#set.has(this.#serialise(key));
    }

    delete(key: K): boolean {
        const svalue = this.#serialise(key);
        return this.#set.delete(svalue);
    }

    clear(): void {
        this.#set.clear();
    }

    values(): IterableIterator<K> {
        return this.entries();
    }

    keys(): IterableIterator<K> {
        return this.values();
    }

    entries(): IterableIterator<K> {
        const set = this.#set;
        const deserialise = (s: Primitive) => this.#deserialise(s);
        const it = set.entries();
        return {
            [Symbol.iterator]() {
                return this;
            },
            next(): IteratorResult<K> {
                const result = it.next();
                if (result.done) return { done: true, value: undefined };
                const [serialisedVal] = result.value;
                const originalVal = deserialise(serialisedVal);
                return { done: false, value: originalVal };
            },
        };
    }

    forEach(callback: (value: K, value2: K, set: this) => void): void {
        for (const value of this.values()) {
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
