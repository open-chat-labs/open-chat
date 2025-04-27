import {
    defaultDeserialiser,
    defaultSerialiser,
    SafeMap,
    type ChatIdentifier,
    type CommunityIdentifier,
    type Primitive,
} from "openchat-shared";
import { SvelteMap } from "svelte/reactivity";
import { ReactiveSafeSet } from "./set";
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

export class LocalMap<K, V> {
    #addedOrUpdated: ReactiveSafeMap<K, V>;
    #removed: ReactiveSafeSet<K>;

    constructor(
        private serialiser?: (k: K) => Primitive,
        private deserialiser?: (p: Primitive) => K,
    ) {
        this.#addedOrUpdated = new ReactiveSafeMap(serialiser, deserialiser);
        this.#removed = new ReactiveSafeSet(serialiser);
    }

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

    apply(original: ReadonlyMap<K, V>): SafeMap<K, V> {
        const merged = new SafeMap<K, V>(this.serialiser, this.deserialiser);
        for (const [k, v] of original) {
            merged.set(k, v);
        }
        this.#addedOrUpdated.forEach((v, k) => merged.set(k, v));
        this.#removed.forEach((k) => merged.delete(k));
        return merged;
    }
}

export class ReactiveSafeMap<K, V> {
    #isPrimitive: boolean;
    #serialise: (key: K) => Primitive;
    #deserialise: (key: Primitive) => K;
    #map = new SvelteMap<Primitive, V>();

    #newMap<A>(): ReactiveSafeMap<K, A> {
        return this.#isPrimitive
            ? new ReactiveSafeMap<K, A>()
            : new ReactiveSafeMap<K, A>(this.#serialise, this.#deserialise);
    }

    constructor(serialiser?: (key: K) => Primitive, deserialiser?: (primitive: Primitive) => K) {
        this.#isPrimitive = serialiser === undefined && deserialiser === undefined;
        this.#serialise = serialiser ?? defaultSerialiser;
        this.#deserialise = deserialiser ?? defaultDeserialiser;
    }

    [Symbol.iterator](): Iterator<[K, V]> {
        return this.entries();
    }

    map<A>(fn: (key: K, val: V) => A): ReactiveSafeMap<K, A> {
        const mapped = this.#newMap<A>();
        for (const [k, v] of this.entries()) {
            mapped.set(k, fn(k, v));
        }
        return mapped;
    }

    merge(other: ReactiveSafeMap<K, V>): ReactiveSafeMap<K, V> {
        other.forEach((val, key) => {
            this.set(key, val);
        });
        return this;
    }

    filter(fn: (value: V, key: K) => boolean): ReactiveSafeMap<K, V> {
        return [...this.entries()]
            .filter(([k, v]) => {
                return fn(v, k);
            })
            .reduce((agg, [k, v]) => {
                agg.set(k, v);
                return agg;
            }, this.#newMap<V>());
    }

    reduce<U>(reducer: (acc: U, [k, v]: [K, V], map: this) => U, initialValue: U): U {
        let acc = initialValue;
        for (const entry of this) {
            acc = reducer(acc, entry, this);
        }
        return acc;
    }

    clone(): ReactiveSafeMap<K, V> {
        const cloned = this.#newMap<V>();
        for (const [key, value] of this) {
            cloned.set(key, value);
        }
        return cloned;
    }

    empty(): ReactiveSafeMap<K, V> {
        return this.#newMap<V>();
    }

    clear(): void {
        this.#map.clear();
    }

    values(): IterableIterator<V> {
        return this.#map.values();
    }

    keys(): IterableIterator<K> {
        const entryIter = this[Symbol.iterator]();
        return {
            [Symbol.iterator]() {
                return this;
            },
            next(): IteratorResult<K> {
                const { done, value } = entryIter.next();
                if (done) return { done, value: undefined };
                return { done: false, value: value[0] };
            },
        };
    }

    entries(): IterableIterator<[K, V]> {
        const map = this.#map;
        const deserialise = (s: Primitive) => this.#deserialise(s);
        const it = map.entries();
        return {
            [Symbol.iterator]() {
                return this;
            },
            next(): IteratorResult<[K, V]> {
                const result = it.next();
                if (result.done) return { done: true, value: undefined };
                const [serialisedKey, value] = result.value;
                const originalKey = deserialise(serialisedKey);
                return { done: false, value: [originalKey, value] };
            },
        };
    }

    delete(key: K): boolean {
        if (this.#map.size === 0) return false;
        return this.#map.delete(this.#serialise(key));
    }

    forEach(callbackfn: (value: V, key: K, map: ReactiveSafeMap<K, V>) => void): void {
        for (const [k, value] of this.#map.entries()) {
            callbackfn(value, this.#deserialise(k), this);
        }
    }

    get(key: K): V | undefined {
        if (this.#map.size === 0) return undefined;
        return this.#map.get(this.#serialise(key));
    }

    has(key: K): boolean {
        if (this.#map.size === 0) return false;
        return this.#map.has(this.#serialise(key));
    }

    set(key: K, value: V): this {
        this.#map.set(this.#serialise(key), value);
        return this;
    }

    get size(): number {
        return this.#map.size;
    }

    toMap(): Map<Primitive, V> {
        return this.#map;
    }
}

export class ReactiveCommunityMap<V> extends ReactiveSafeMap<CommunityIdentifier, V> {
    constructor() {
        super(
            (id) => id.communityId,
            (k) => ({ kind: "community", communityId: String(k) }),
        );
    }
}

export class ReactiveChatMap<V> extends ReactiveSafeMap<ChatIdentifier, V> {
    constructor() {
        super(
            (id) => JSON.stringify(id),
            (k) => JSON.parse(String(k)) as ChatIdentifier,
        );
    }
}

export class LocalCommunityMap<V> extends LocalMap<CommunityIdentifier, V> {
    constructor() {
        super(
            (id) => id.communityId,
            (k) => ({ kind: "community", communityId: String(k) }),
        );
    }
}
