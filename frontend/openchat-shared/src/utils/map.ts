/**
 * we have quite a few maps that are keyed on chatId
 * These are usually Record<string, T>
 * But that doesn't work with ChatIdentifier
 *  */

import type { CommunityIdentifier } from "../domain";
import type { ChatIdentifier, MessageContext } from "../domain/chat";

export class SafeMap<K, V> {
    protected constructor(
        private toString: (key: K) => string,
        private fromString: (key: string) => K,
        protected _map: Map<string, V> = new Map<string, V>()
    ) {}

    clone(): SafeMap<K, V> {
        const clone = new SafeMap<K, V>(this.toString, this.fromString, new Map(this._map));
        return clone;
    }

    empty(): SafeMap<K, V> {
        return new SafeMap<K, V>(this.toString, this.fromString);
    }

    clear(): void {
        this._map.clear();
    }

    values(): V[] {
        return [...this._map.values()];
    }

    keys(): K[] {
        return [...this._map.keys()].map((k) => this.fromString(k));
    }

    entries(): [K, V][] {
        return [...this._map.entries()].map(([key, value]: [string, V]) => [
            this.fromString(key),
            value,
        ]);
    }

    delete(key: K): boolean {
        return this._map.delete(this.toString(key));
    }
    forEach(callbackfn: (value: V, key: K) => void): void {
        this._map.forEach((value, key) => {
            callbackfn(value, this.fromString(key));
        });
    }
    get(key: K): V | undefined {
        return this._map.get(this.toString(key));
    }
    has(key: K): boolean {
        return this._map.has(this.toString(key));
    }
    set(key: K, value: V): this {
        this._map.set(this.toString(key), value);
        return this;
    }
    get size(): number {
        return this._map.size;
    }

    toMap(): Map<string, V> {
        return this._map;
    }

    toRecord(): Record<string, V> {
        return Object.fromEntries(this._map.entries());
    }
}

export class ChatMap<V> extends SafeMap<ChatIdentifier, V> {
    constructor(_map: Map<string, V> = new Map<string, V>()) {
        super(
            (k: ChatIdentifier) => JSON.stringify(k),
            (k: string) => JSON.parse(k) as ChatIdentifier,
            _map
        );
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

    static fromRecord<V>(rec: Record<string, V>): ChatMap<V> {
        return new ChatMap<V>(new Map(Object.entries(rec)));
    }

    static fromJSON<V>(json: string): ChatMap<V> {
        return new ChatMap<V>(new Map(JSON.parse(json)));
    }
}

export class MessageContextMap<V> extends SafeMap<MessageContext, V> {
    constructor(_map: Map<string, V> = new Map<string, V>()) {
        super(
            (k: MessageContext) => JSON.stringify(k),
            (k: string) => JSON.parse(k) as MessageContext,
            _map
        );
    }

    static fromRecord<V>(rec: Record<string, V>): MessageContextMap<V> {
        return new MessageContextMap<V>(new Map(Object.entries(rec)));
    }

    static fromMap<V>(map: Map<string, V>): MessageContextMap<V> {
        return new MessageContextMap<V>(map);
    }
}

export class CommunityMap<V> extends SafeMap<CommunityIdentifier, V> {
    constructor() {
        super(
            (k: CommunityIdentifier) => k.communityId,
            (k: string) => ({ kind: "community", communityId: k })
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
    constructor() {
        super(
            (k: bigint) => k.toString(),
            (k: string) => BigInt(k)
        );
    }
}
