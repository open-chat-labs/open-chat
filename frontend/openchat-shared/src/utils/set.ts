import {
    defaultDeserialiser,
    defaultSerialiser,
    type ChatIdentifier,
    type Primitive,
} from "../domain";

export interface ReadonlySet<V> extends Iterable<V> {
    has(item: V): boolean;
    get size(): number;
    values(): IterableIterator<V>;
    keys(): IterableIterator<V>;
    entries(): IterableIterator<[V, V]>;
    forEach(callbackfn: (value: V, value2: V, set: ReadonlySet<V>) => void): void;
    [Symbol.iterator](): IterableIterator<V>;
}

export interface SetLike<V> {
    add(value: V): this;
    has(value: V): boolean;
    delete(value: V): boolean;
    clear(): void;
    get size(): number;
    keys(): IterableIterator<V>;
    values(): IterableIterator<V>;
    entries(): IterableIterator<[V, V]>;
    [Symbol.iterator](): IterableIterator<V>;
}

export class SafeSet<V> {
    #isPrimitive: boolean;
    #serialise: (key: V) => Primitive;
    #deserialise: (key: Primitive) => V;
    #set: SetLike<Primitive>;

    #newSet(): SafeSet<V> {
        return this.#isPrimitive
            ? new SafeSet<V>(undefined, undefined)
            : new SafeSet<V>(this.#serialise, this.#deserialise);
    }

    public constructor(
        serialiser?: (v: V) => Primitive,
        deserialiser?: (primitive: Primitive) => V,
        set?: SetLike<Primitive>,
    ) {
        this.#isPrimitive = serialiser === undefined && deserialiser === undefined;
        this.#serialise = serialiser ?? defaultSerialiser;
        this.#deserialise = deserialiser ?? defaultDeserialiser;
        this.#set = set ?? new Set<Primitive>();
    }

    clone(): SafeSet<V> {
        const clone = this.#newSet();
        for (const val of this) {
            clone.add(val);
        }
        return clone;
    }

    forEach(callbackfn: (value: V, value2: V, set: ReadonlySet<V>) => void): void {
        for (const value of this) {
            callbackfn(value, value, this as unknown as ReadonlySet<V>);
        }
    }

    entries(): IterableIterator<[V, V]> {
        const set = this.#set;
        const deserialise = (s: Primitive) => this.#deserialise(s);
        const it = set.entries();
        return {
            [Symbol.iterator]() {
                return this;
            },
            next(): IteratorResult<[V, V]> {
                const result = it.next();
                if (result.done) return { done: true, value: undefined };
                const [serialisedVal] = result.value;
                const originalVal = deserialise(serialisedVal);
                return { done: false, value: [originalVal, originalVal] };
            },
        };
    }

    values(): IterableIterator<V> {
        return this.keys();
    }

    keys(): IterableIterator<V> {
        const set = this.#set;
        const deserialise = (s: Primitive) => this.#deserialise(s);
        const it = set.entries();
        return {
            [Symbol.iterator]() {
                return this;
            },
            next(): IteratorResult<V> {
                const result = it.next();
                if (result.done) return { done: true, value: undefined };
                const [serialisedVal] = result.value;
                const originalVal = deserialise(serialisedVal);
                return { done: false, value: originalVal };
            },
        };
    }

    [Symbol.iterator](): IterableIterator<V> {
        return this.values();
    }

    empty(): SafeSet<V> {
        return this.#newSet();
    }

    clear(): void {
        this.#set.clear();
    }

    delete(value: V): boolean {
        const svalue = this.#serialise(value);
        return this.#set.delete(svalue);
    }

    has(value: V): boolean {
        return this.#set.has(this.#serialise(value));
    }

    add(value: V): this {
        const svalue = this.#serialise(value);
        this.#set.add(svalue);
        return this;
    }

    get size(): number {
        return this.#set.size;
    }

    toSet(): SetLike<Primitive> {
        return this.#set;
    }

    static fromList<V>(values: V[]): SafeSet<V> {
        const set = new SafeSet<V>();
        values.forEach((value) => set.add(value));
        return set;
    }
}

export class ChatSet extends SafeSet<ChatIdentifier> {
    constructor(values?: ChatIdentifier[]) {
        super(
            (k) => JSON.stringify(k),
            (k) => JSON.parse(String(k)) as ChatIdentifier,
        );
        values?.forEach((v) => this.add(v));
    }
}
