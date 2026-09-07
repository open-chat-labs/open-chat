/**
 * we have quite a few maps that are keyed on chatId
 * These are usually Record<string, T>
 * But that doesn't work with ChatIdentifier
 *  */

import {
    defaultDeserialiser,
    defaultSerialiser,
    type ChatListScope,
    type CommunityIdentifier,
    type Primitive,
} from "../domain";
import type { ChatIdentifier, MessageContext } from "../domain/chat";

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

export class SafeMap<K, V> {
    #isPrimitive: boolean;
    #serialise: (key: K) => Primitive;
    #deserialise: (key: Primitive) => K;
    // the original key is stored alongside the value so that iteration never
    // needs to deserialise it
    #map: Map<Primitive, [K, V]>;

    #newMap<A>(): SafeMap<K, A> {
        return this.#isPrimitive
            ? new SafeMap<K, A>(undefined, undefined)
            : new SafeMap<K, A>(this.#serialise, this.#deserialise);
    }

    constructor(
        serialiser?: (key: K) => Primitive,
        deserialiser?: (primitive: Primitive) => K,
        map?: MapLike<Primitive, V>,
    ) {
        this.#isPrimitive = serialiser === undefined && deserialiser === undefined;
        this.#serialise = serialiser ?? defaultSerialiser;
        this.#deserialise = deserialiser ?? defaultDeserialiser;
        this.#map = new Map<Primitive, [K, V]>();
        if (map !== undefined) {
            for (const [k, v] of map.entries()) {
                this.#map.set(k, [this.#deserialise(k), v]);
            }
        }
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
        const it = this.#map.values();
        return {
            [Symbol.iterator]() {
                return this;
            },
            next(): IteratorResult<V> {
                const result = it.next();
                if (result.done) return { done: true, value: undefined };
                return { done: false, value: result.value[1] };
            },
        };
    }

    keys(): IterableIterator<K> {
        const it = this.#map.values();
        return {
            [Symbol.iterator]() {
                return this;
            },
            next(): IteratorResult<K> {
                const result = it.next();
                if (result.done) return { done: true, value: undefined };
                return { done: false, value: result.value[0] };
            },
        };
    }

    entries(): IterableIterator<[K, V]> {
        const it = this.#map.values();
        return {
            [Symbol.iterator]() {
                return this;
            },
            next(): IteratorResult<[K, V]> {
                const result = it.next();
                if (result.done) return { done: true, value: undefined };
                const [key, value] = result.value;
                return { done: false, value: [key, value] };
            },
        };
    }

    delete(key: K): boolean {
        if (this.#map.size === 0) return false;
        return this.#map.delete(this.#serialise(key));
    }

    forEach(callbackfn: (value: V, key: K, map: SafeMap<K, V>) => void): void {
        for (const [key, value] of this.#map.values()) {
            callbackfn(value, key, this);
        }
    }

    get(key: K): V | undefined {
        if (this.#map.size === 0) return undefined;
        return this.#map.get(this.#serialise(key))?.[1];
    }

    has(key: K): boolean {
        if (this.#map.size === 0) return false;
        return this.#map.has(this.#serialise(key));
    }

    set(key: K, value: V): this {
        this.#map.set(this.#serialise(key), [key, value]);
        return this;
    }

    get size(): number {
        return this.#map.size;
    }

    toMap(): MapLike<Primitive, V> {
        const map = new Map<Primitive, V>();
        for (const [k, [, v]] of this.#map.entries()) {
            map.set(k, v);
        }
        return map;
    }

    static fromEntries<K, V>(
        entries: IterableIterator<[K, V]>,
        serialiser?: (key: K) => Primitive,
        deserialiser?: (primitive: Primitive) => K,
    ): SafeMap<K, V> {
        const map = new SafeMap<K, V>(serialiser, deserialiser);
        for (const [k, v] of entries) {
            map.set(k, v);
        }
        return map;
    }
}

// Hand-rolled key codecs: much cheaper than JSON.stringify/parse and injective
// across identifier kinds (ids are principals / numbers so never contain "|")
export function chatIdentifierToKey(id: ChatIdentifier): string {
    switch (id.kind) {
        case "direct_chat":
            return "d|" + id.userId;
        case "group_chat":
            return "g|" + id.groupId;
        case "channel":
            return "c|" + id.communityId + "|" + id.channelId;
        default:
            throw new Error(`Unknown chat identifier kind: ${JSON.stringify(id)}`);
    }
}

export function chatIdentifierFromKey(key: string): ChatIdentifier {
    switch (key[0]) {
        case "d":
            return { kind: "direct_chat", userId: key.slice(2) };
        case "g":
            return { kind: "group_chat", groupId: key.slice(2) };
        case "c": {
            const i = key.lastIndexOf("|");
            return {
                kind: "channel",
                communityId: key.slice(2, i),
                channelId: Number(key.slice(i + 1)),
            };
        }
        default:
            throw new Error(`Invalid chat identifier key: ${key}`);
    }
}

export function messageContextToKey(ctx: MessageContext): string {
    return chatIdentifierToKey(ctx.chatId) + "|" + (ctx.threadRootMessageIndex ?? "");
}

export function messageContextFromKey(key: string): MessageContext {
    const i = key.lastIndexOf("|");
    const chatId = chatIdentifierFromKey(key.slice(0, i));
    const thread = key.slice(i + 1);
    return thread === "" ? { chatId } : { chatId, threadRootMessageIndex: Number(thread) };
}

export function chatListScopeToKey(scope: ChatListScope): string {
    return scope.kind === "community" ? "community|" + scope.id.communityId : scope.kind;
}

export function chatListScopeFromKey(key: string): ChatListScope {
    if (key.startsWith("community|")) {
        return { kind: "community", id: { kind: "community", communityId: key.slice(10) } };
    }
    return { kind: key as Exclude<ChatListScope, { kind: "community" }>["kind"] };
}

// This is a bit weird
export class GlobalMap<V> extends SafeMap<"global", V> {
    constructor(_map?: Map<"global", V>) {
        super(
            (_: "global") => "global",
            (_) => "global",
            _map,
        );
    }
}

export class ChatMap<V> extends SafeMap<ChatIdentifier, V> {
    constructor(_map?: Map<string, V>) {
        super((k) => chatIdentifierToKey(k), (k) => chatIdentifierFromKey(String(k)), _map);
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

export class MessageContextMap<V> extends SafeMap<MessageContext, V> {
    constructor(_map?: Map<string, V>) {
        super((k) => messageContextToKey(k), (k) => messageContextFromKey(String(k)), _map);
    }

    static fromMap<V>(map: Map<string, V>): MessageContextMap<V> {
        return new MessageContextMap<V>(map);
    }
}

export class ChatListScopeMap<V> extends SafeMap<ChatListScope, V> {
    constructor(_map?: Map<string, V>) {
        super((k) => chatListScopeToKey(k), (k) => chatListScopeFromKey(String(k)), _map);
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
