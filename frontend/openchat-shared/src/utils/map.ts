/**
 * we have quite a few maps that are keyed on chatId
 * These are usually Record<string, T>
 * But that doesn't work with ChatIdentifier
 *  */

import {
    defaultDeserialiser,
    defaultSerialiser,
    type CommunityIdentifier,
    type Primitive,
} from "../domain";
import type { ChatIdentifier, MessageContext } from "../domain/chat";

export interface MapLike<K, V> {
    set(key: K, value: V): this;
    get(key: K): V | undefined;
    has(key: K): boolean;
    delete(key: K): boolean;
    clear(): void;
    get size(): number;
    keys(): IterableIterator<K>;
    values(): IterableIterator<V>;
    entries(): IterableIterator<[K, V]>;
    [Symbol.iterator](): IterableIterator<[K, V]>;
}

export type MapFactory<K> = <V>() => MapLike<K, V>;

export class SafeMap<K, V> {
    #isPrimitive: boolean;
    #serialise: (key: K) => Primitive;
    #deserialise: (key: Primitive) => K;
    #map: MapLike<Primitive, V>;
    #mapFactory: MapFactory<Primitive>;

    #newMap<A>(): SafeMap<K, A> {
        return this.#isPrimitive
            ? new SafeMap<K, A>(undefined, undefined, this.#mapFactory)
            : new SafeMap<K, A>(this.#serialise, this.#deserialise, this.#mapFactory);
    }

    constructor(
        serialiser?: (key: K) => Primitive,
        deserialiser?: (primitive: Primitive) => K,
        mapFactory?: MapFactory<Primitive>,
        map?: MapLike<Primitive, V>,
    ) {
        this.#isPrimitive = serialiser === undefined && deserialiser === undefined;
        this.#serialise = serialiser ?? defaultSerialiser;
        this.#deserialise = deserialiser ?? defaultDeserialiser;
        this.#mapFactory = mapFactory ?? (<V>() => new Map<Primitive, V>());
        this.#map = map ?? (mapFactory ? mapFactory() : new Map<Primitive, V>());
    }

    [Symbol.iterator](): Iterator<[K, V]> {
        return this.entries();
    }

    map<A>(fn: (key: K, val: V) => A): SafeMap<K, A> {
        const mapped = this.#newMap<A>();
        for (const [k, v] of this.entries()) {
            mapped.set(k, fn(k, v));
        }
        return mapped;
    }

    merge(other: SafeMap<K, V>): SafeMap<K, V> {
        other.forEach((val, key) => {
            this.set(key, val);
        });
        return this;
    }

    filter(fn: (value: V, key: K) => boolean): SafeMap<K, V> {
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

    clone(): SafeMap<K, V> {
        const cloned = this.#newMap<V>();
        for (const [key, value] of this) {
            cloned.set(key, value);
        }
        return cloned;
    }

    empty(): SafeMap<K, V> {
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
        const deserialise = (s: Primitive) => this.#deserialise(s);
        const it = this.#map.entries();
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

    forEach(callbackfn: (value: V, key: K, map: SafeMap<K, V>) => void): void {
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

    toMap(): MapLike<Primitive, V> {
        return this.#map;
    }
}

// This is a bit weird
export class GlobalMap<V> extends SafeMap<"global", V> {
    constructor(_map?: Map<"global", V>) {
        super(
            (_: "global") => "global",
            (_) => "global",
            undefined,
            _map,
        );
    }
}

export class ChatMap<V> extends SafeMap<ChatIdentifier, V> {
    constructor(_map?: Map<string, V>) {
        super(
            (k) => JSON.stringify(k),
            (k) => JSON.parse(String(k)) as ChatIdentifier,
            undefined,
            _map,
        );
    }

    static fromList<T extends { id: ChatIdentifier }>(things: T[]): ChatMap<T> {
        return things.reduce((map, c) => {
            map.set(c.id, c);
            return map;
        }, new ChatMap<T>());
    }

    static fromMap<V>(map: Map<string, V>): ChatMap<V> {
        console.log("From map: ", map);
        return new ChatMap<V>(map);
    }

    static fromJSON<V>(json: string): ChatMap<V> {
        return new ChatMap<V>(new Map(JSON.parse(json)));
    }
}

export class MessageContextMap<V> extends SafeMap<MessageContext, V> {
    constructor(_map?: Map<string, V>) {
        super(
            (k) => JSON.stringify(k),
            (k) => JSON.parse(String(k)) as MessageContext,
            undefined,
            _map,
        );
    }

    static fromMap<V>(map: Map<string, V>): MessageContextMap<V> {
        return new MessageContextMap<V>(map);
    }
}

export class CommunityMap<V> extends SafeMap<CommunityIdentifier, V> {
    constructor() {
        super(
            (k) => k.communityId,
            (k) => ({ kind: "community", communityId: String(k) }),
        );
    }

    static fromList<T extends { id: CommunityIdentifier }>(things: T[]): CommunityMap<T> {
        return things.reduce((map, c) => {
            map.set(c.id, c);
            return map;
        }, new CommunityMap<T>());
    }
}

export class MessageMap<V> extends SafeMap<bigint, V> {
    constructor(entries?: readonly (readonly [bigint, V])[] | undefined) {
        super(
            (k) => k.toString(),
            (k) => BigInt(k),
        );

        if (entries !== undefined) {
            for (const [k, v] of entries) {
                this.set(k, v);
            }
        }
    }
}

export function getOrAdd<K, V>(map: Map<K, V>, key: K, value: V): V {
    const existing = map.get(key);
    if (existing !== undefined) {
        return existing;
    }
    map.set(key, value);
    return value;
}
