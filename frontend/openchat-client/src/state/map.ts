import {
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

export class LocalMap<K, V, P extends Primitive> {
    #addedOrUpdated: ReactiveSafeMap<K, V, P>;
    #removed: ReactiveSafeSet<K>;

    constructor(
        private serialiser: (k: K) => P,
        private deserialiser: (p: P) => K,
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

    apply(original: ReadonlyMap<K, V>): SafeMap<K, V, P> {
        const merged = new SafeMap<K, V, P>(this.serialiser, this.deserialiser);
        for (const [k, v] of original) {
            merged.set(k, v);
        }
        this.#addedOrUpdated.forEach((v, k) => merged.set(k, v));
        this.#removed.forEach((k) => merged.delete(k));
        return merged;
    }
}

export class ReactiveSafeMap<K, V, P extends Primitive> {
    #keyMap = new Map<P, K>();
    #map = new SvelteMap<P, V>();
    #deserialise(k: P): K {
        let key = this.#keyMap.get(k);
        if (key === undefined) {
            key = this._deserialise(k);
            this.#keyMap.set(k, key);
        }
        return key;
    }

    constructor(
        private _serialise: (key: K) => P,
        private _deserialise: (primitive: P) => K,
    ) {}

    [Symbol.iterator](): Iterator<[K, V]> {
        return this.entries();
    }

    map<A>(fn: (key: K, val: V) => A): ReactiveSafeMap<K, A, P> {
        const mapped = new ReactiveSafeMap<K, A, P>(this._serialise, this._deserialise);
        for (const [k, v] of this.entries()) {
            mapped.set(k, fn(k, v));
        }
        return mapped;
    }

    merge(other: ReactiveSafeMap<K, V, P>): ReactiveSafeMap<K, V, P> {
        other.forEach((val, key) => {
            this.set(key, val);
        });
        return this;
    }

    filter(fn: (value: V, key: K) => boolean): ReactiveSafeMap<K, V, P> {
        return [...this.entries()]
            .filter(([k, v]) => {
                return fn(v, k);
            })
            .reduce(
                (agg, [k, v]) => {
                    agg.set(k, v);
                    return agg;
                },
                new ReactiveSafeMap<K, V, P>(this._serialise, this._deserialise),
            );
    }

    reduce<U>(reducer: (acc: U, [k, v]: [K, V], map: this) => U, initialValue: U): U {
        let acc = initialValue;
        for (const entry of this) {
            acc = reducer(acc, entry, this);
        }
        return acc;
    }

    clone(): ReactiveSafeMap<K, V, P> {
        const cloned = new ReactiveSafeMap<K, V, P>(this._serialise, this._deserialise);
        for (const [key, value] of this) {
            cloned.set(key, value);
        }
        return cloned;
    }

    empty(): ReactiveSafeMap<K, V, P> {
        return new ReactiveSafeMap<K, V, P>(this._serialise, this._deserialise);
    }

    clear(): void {
        this.#keyMap.clear();
        this.#map.clear();
    }

    values(): IterableIterator<V> {
        return this.#map.values();
    }

    keys(): IterableIterator<K> {
        return this.#keyMap.values();
    }

    entries(): IterableIterator<[K, V]> {
        const map = this.#map;
        const keyMap = this.#keyMap;
        const it = map.entries();
        return {
            [Symbol.iterator]() {
                return this;
            },
            next(): IteratorResult<[K, V]> {
                const result = it.next();
                if (result.done) return { done: true, value: undefined };
                const [serialisedKey, value] = result.value;
                const originalKey = keyMap.get(serialisedKey)!;
                return { done: false, value: [originalKey, value] };
            },
        };
    }

    delete(key: K): boolean {
        if (this.#map.size === 0) return false;
        const k = this._serialise(key);
        if (this.#map.has(k)) {
            this.#keyMap.delete(k);
            return this.#map.delete(k);
        }
        return false;
    }

    forEach(callbackfn: (value: V, key: K, map: ReactiveSafeMap<K, V, P>) => void): void {
        for (const [k, value] of this.#map.entries()) {
            callbackfn(value, this.#deserialise(k), this);
        }
    }

    get(key: K): V | undefined {
        if (this.#map.size === 0) return undefined;
        return this.#map.get(this._serialise(key));
    }

    has(key: K): boolean {
        if (this.#map.size === 0) return false;
        return this.#map.has(this._serialise(key));
    }

    set(key: K, value: V): this {
        const k = this._serialise(key);
        this.#map.set(k, value);
        this.#keyMap.set(k, key);
        return this;
    }

    get size(): number {
        return this.#map.size;
    }

    toMap(): Map<P, V> {
        return this.#map;
    }
}

export class ReactiveCommunityMap<V> extends ReactiveSafeMap<CommunityIdentifier, V, string> {
    constructor() {
        super(
            (id) => id.communityId,
            (k) => ({ kind: "community", communityId: k }),
        );
    }
}

export class ReactiveChatMap<V> extends ReactiveSafeMap<ChatIdentifier, V, string> {
    constructor() {
        super(
            (id) => JSON.stringify(id),
            (k) => JSON.parse(k) as ChatIdentifier,
        );
    }
}

export class LocalCommunityMap<V> extends LocalMap<CommunityIdentifier, V, string> {
    constructor() {
        super(
            (id) => id.communityId,
            (k) => ({ kind: "community", communityId: k }),
        );
    }
}
