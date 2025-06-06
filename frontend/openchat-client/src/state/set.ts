import {
    SafeSet,
    type ChatIdentifier,
    type Primitive,
    type ReadonlySet,
    chatIdentifierToInt,
    chatIdentifierFromInt
} from "openchat-shared";
import { type UndoLocalUpdate } from "./undo";

export class LocalSet<T> {
    #added: SafeSet<T>;
    #removed: SafeSet<T>;

    constructor(
        private serialiser?: (x: T) => Primitive,
        private deserialiser?: (x: Primitive) => T,
    ) {
        this.#added = new SafeSet(serialiser, deserialiser);
        this.#removed = new SafeSet(serialiser, deserialiser);
    }

    get added(): ReadonlySet<T> {
        return this.#added;
    }

    get removed(): ReadonlySet<T> {
        return this.#removed;
    }

    // only use for testing
    clear() {
        this.#added.clear();
        this.#removed.clear();
    }

    add(thing: T): UndoLocalUpdate {
        this.#added.add(thing);
        const removed = this.#removed.delete(thing);
        return () => {
            this.#added.delete(thing);
            if (removed) {
                this.#removed.add(thing);
            }
        };
    }

    remove(thing: T) {
        this.#removed.add(thing);
        const removed = this.#added.delete(thing);
        return () => {
            this.#removed.delete(thing);
            if (removed) {
                this.#added.add(thing);
            }
        };
    }

    apply(original: ReadonlySet<T>): ReadonlySet<T> {
        if (this.#added.size === 0 && this.#removed.size === 0) return original;
        const merged = new SafeSet<T>(this.serialiser, this.deserialiser);
        for (const v of original) {
            merged.add(v);
        }
        this.#added.forEach((t) => merged.add(t));
        this.#removed.forEach((t) => merged.delete(t));
        return merged;
    }
}

export class ChatLocalSet extends LocalSet<ChatIdentifier> {
    constructor() {
        super(
            chatIdentifierToInt,
            (k) => chatIdentifierFromInt(k as number),
        );
    }
}
