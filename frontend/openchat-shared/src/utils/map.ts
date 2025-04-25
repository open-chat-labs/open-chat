/**
 * we have quite a few maps that are keyed on chatId
 * These are usually Record<string, T>
 * But that doesn't work with ChatIdentifier
 *  */

import type { CommunityIdentifier, Primitive } from "../domain";
import type { ChatIdentifier, MessageContext } from "../domain/chat";

// TODO - this is basically identical to the ReactiveSafeMap except the underlying data is held in a Map rather than a SvelteMap
// Can we consolidate that
export class SafeMap<K, V, P extends Primitive> {
    #keyMap = new Map<P, K>();
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
        protected _map: Map<P, V> = new Map<P, V>(),
    ) {}

    [Symbol.iterator](): Iterator<[K, V]> {
        return this.entries();
    }

    map<A>(fn: (key: K, val: V) => A): SafeMap<K, A, P> {
        const mapped = new SafeMap<K, A, P>(this._serialise, this._deserialise);
        for (const [k, v] of this.entries()) {
            mapped.set(k, fn(k, v));
        }
        return mapped;
    }

    merge(other: SafeMap<K, V, P>): SafeMap<K, V, P> {
        other.forEach((val, key) => {
            this.set(key, val);
        });
        return this;
    }

    filter(fn: (value: V, key: K) => boolean): SafeMap<K, V, P> {
        return [...this.entries()]
            .filter(([k, v]) => {
                return fn(v, k);
            })
            .reduce(
                (agg, [k, v]) => {
                    agg.set(k, v);
                    return agg;
                },
                new SafeMap<K, V, P>(this._serialise, this._deserialise),
            );
    }

    reduce<U>(reducer: (acc: U, [k, v]: [K, V], map: this) => U, initialValue: U): U {
        let acc = initialValue;
        for (const entry of this) {
            acc = reducer(acc, entry, this);
        }
        return acc;
    }

    clone(): SafeMap<K, V, P> {
        const cloned = new SafeMap<K, V, P>(this._serialise, this._deserialise);
        for (const [key, value] of this) {
            cloned.set(key, value);
        }
        return cloned;
    }

    empty(): SafeMap<K, V, P> {
        return new SafeMap<K, V, P>(this._serialise, this._deserialise);
    }

    clear(): void {
        this.#keyMap.clear();
        this._map.clear();
    }

    values(): IterableIterator<V> {
        return this._map.values();
    }

    keys(): IterableIterator<K> {
        return this.#keyMap.values();
    }

    entries(): IterableIterator<[K, V]> {
        const map = this._map;
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
        if (this._map.size === 0) return false;
        const k = this._serialise(key);
        if (this._map.has(k)) {
            this.#keyMap.delete(k);
            return this._map.delete(k);
        }
        return false;
    }

    forEach(callbackfn: (value: V, key: K, map: SafeMap<K, V, P>) => void): void {
        for (const [k, value] of this._map.entries()) {
            callbackfn(value, this.#deserialise(k), this);
        }
    }

    get(key: K): V | undefined {
        if (this._map.size === 0) return undefined;
        return this._map.get(this._serialise(key));
    }

    has(key: K): boolean {
        if (this._map.size === 0) return false;
        return this._map.has(this._serialise(key));
    }

    set(key: K, value: V): this {
        const k = this._serialise(key);
        this._map.set(k, value);
        this.#keyMap.set(k, key);
        return this;
    }

    get size(): number {
        return this._map.size;
    }

    toMap(): Map<P, V> {
        return this._map;
    }
}

// This is a bit weird
export class GlobalMap<V> extends SafeMap<"global", V, string> {
    constructor(_map?: Map<"global", V>) {
        super(
            (_: "global") => "global",
            (_) => "global",
            _map,
        );
    }
}

export class ChatMap<V> extends SafeMap<ChatIdentifier, V, string> {
    constructor(_map?: Map<string, V>) {
        super(JSON.stringify, (k) => JSON.parse(String(k)) as ChatIdentifier, _map);
    }

    static fromList<T extends { id: ChatIdentifier }>(things: T[]): ChatMap<T> {
        return things.reduce((map, c) => {
            map.set(c.id, c);
            return map;
        }, new ChatMap<T>());
    }

    static fromMap<V>(map: Map<string, V>): ChatMap<V> {
        return new ChatMap<V>(map);
    }

    static fromJSON<V>(json: string): ChatMap<V> {
        return new ChatMap<V>(new Map(JSON.parse(json)));
    }
}

export class MessageContextMap<V> extends SafeMap<MessageContext, V, string> {
    constructor(_map?: Map<string, V>) {
        super(JSON.stringify, (k) => JSON.parse(k) as MessageContext, _map);
    }

    static fromMap<V>(map: Map<string, V>): MessageContextMap<V> {
        return new MessageContextMap<V>(map);
    }
}

export class CommunityMap<V> extends SafeMap<CommunityIdentifier, V, string> {
    constructor() {
        super(
            (k) => k.communityId,
            (k) => ({ kind: "community", communityId: k }),
        );
    }

    static fromList<T extends { id: CommunityIdentifier }>(things: T[]): CommunityMap<T> {
        return things.reduce((map, c) => {
            map.set(c.id, c);
            return map;
        }, new CommunityMap<T>());
    }
}

export class MessageMap<V> extends SafeMap<bigint, V, string> {
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
