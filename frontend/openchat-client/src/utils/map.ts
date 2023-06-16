/**
 * we have quite a few maps that are keyed on chatId
 * These are usually Record<string, T>
 * But that doesn't work with ChatIdentifier
 *  */

import { ChatIdentifier } from "openchat-shared";

export interface ISafeMap<K, V> {
    clear(): void;
    clone(): ISafeMap<K, V>;
    empty(): ISafeMap<K, V>;
    entries(): [K, V][];
    values(): V[];
    delete(key: K): boolean;
    forEach(callbackfn: (value: V, key: K) => void): void;
    get(key: K): V | undefined;
    has(key: K): boolean;
    set(key: K, value: V): this;
    get size(): number;
}

export class SafeMap<K, V> implements ISafeMap<K, V> {
    protected constructor(
        private toString: (key: K) => string,
        private fromString: (key: string) => K,
        private _map: Map<string, V> = new Map<string, V>()
    ) {}

    clone(): ISafeMap<K, V> {
        const clone = new SafeMap<K, V>(this.toString, this.fromString, new Map(this._map));
        return clone;
    }

    empty(): ISafeMap<K, V> {
        return new SafeMap<K, V>(this.toString, this.fromString);
    }

    clear(): void {
        this._map.clear();
    }

    values(): V[] {
        return [...this._map.values()];
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
}

export class ChatMap<V> extends SafeMap<ChatIdentifier, V> implements ISafeMap<ChatIdentifier, V> {
    constructor() {
        super(
            (k: ChatIdentifier) => k.toString(),
            (k: string) => ChatIdentifier.fromString(k)
        );
    }
}

export class MessageMap<V> extends SafeMap<bigint, V> implements ISafeMap<bigint, V> {
    constructor() {
        super(
            (k: bigint) => k.toString(),
            (k: string) => BigInt(k)
        );
    }
}
