import type { Subscriber } from "svelte/store";
import { writable, type EqualityCheck, type Writable } from "../utils/stores";

export class LocalStorageStore<V> {
    #key: string;
    #serialise: (key: V) => string;
    #deserialise: (key: string) => V;
    #store: Writable<V>;

    get value() {
        return this.#store.value;
    }

    get dirty() {
        return this.#store.dirty;
    }

    subscribe = (start: Subscriber<V>, invalidate: (() => void) | undefined) => this.#store.subscribe(start, invalidate);

    update(fn: (val: V) => V) {
        this.#store.update(val => {
            const updated = fn(val);
            this.#write(updated);
            return updated;
        });
    }

    #write(val: V) {
        if (val === undefined) {
            localStorage.removeItem(this.#key);
        } else {
            localStorage.setItem(this.#key, this.#serialise(val));
        }
    }

    constructor(
        key: string,
        defVal: V,
        serialiser?: (key: V) => string,
        deserialiser?: (primitive: string) => V,
        eq?: EqualityCheck<V>,
    ) {
        this.#key = key;
        this.#serialise = serialiser ?? ((v) => v as string);
        this.#deserialise = deserialiser ?? ((v) => v as V);
        const val = localStorage.getItem(this.#key);
        if (val != null) {
            this.#store = writable(this.#deserialise(val), undefined, eq)
        } else {
            this.#store = writable(defVal, undefined, eq)
        }
    }

    set(val: V) {
        this.#write(val);
        this.#store.set(val);
    }

    // Update the in-memory value without touching localStorage. For use where a value changes
    // rapidly (e.g. while dragging) - call `persist` once the value has settled.
    setTransient(val: V) {
        this.#store.set(val);
    }

    persist() {
        this.#write(this.#store.value);
    }
}

export class LocalStorageBoolStore extends LocalStorageStore<boolean> {
    constructor(key: string, defVal: boolean) {
        super(
            key,
            defVal,
            (b) => b.toString(),
            (b) => b === "true",
        );
    }

    toggle = () => {
        this.set(!this.value);
    };
}
