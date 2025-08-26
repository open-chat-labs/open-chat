import { SafeSet, type ChatIdentifier, type Primitive, type ReadonlySet } from "openchat-shared";
import { type UndoLocalUpdate } from "./undo";

type Add<V> = { kind: "add"; value: V };
type Remove<V> = { kind: "remove"; value: V };
type Modification<V> = Add<V> | Remove<V>;

export class LocalSet<T> {
    #queue: Modification<T>[] = [];

    constructor(
        private serialiser?: (x: T) => Primitive,
        private deserialiser?: (x: Primitive) => T,
    ) {}

    get added(): ReadonlySet<T> {
        return new Set(this.#queue.filter((m) => m.kind === "add").map((m) => m.value));
    }

    get removed(): ReadonlySet<T> {
        return new Set(this.#queue.filter((m) => m.kind === "remove").map((m) => m.value));
    }

    // only use for testing
    clear() {
        this.#queue = [];
    }

    add(thing: T): UndoLocalUpdate {
        const add: Add<T> = { kind: "add", value: thing };
        this.#queue.push(add);
        return () => {
            this.#queue = this.#queue.filter((m) => m !== add);
        };
    }

    remove(thing: T) {
        const remove: Remove<T> = { kind: "remove", value: thing };
        this.#queue.push(remove);
        return () => {
            this.#queue = this.#queue.filter((m) => m !== remove);
        };
    }

    apply(original: ReadonlySet<T>): ReadonlySet<T> {
        if (this.#queue.length === 0) return original;
        const merged = new SafeSet<T>(this.serialiser, this.deserialiser);
        for (const v of original) {
            merged.add(v);
        }
        for (const mod of this.#queue) {
            if (mod.kind === "remove") {
                merged.delete(mod.value);
            }
            if (mod.kind === "add") {
                merged.add(mod.value);
            }
        }
        return merged;
    }
}

export class ChatLocalSet extends LocalSet<ChatIdentifier> {
    constructor() {
        super(
            (k) => JSON.stringify(k),
            (k) => JSON.parse(String(k)),
        );
    }
}
