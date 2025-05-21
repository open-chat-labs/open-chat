import {
    SafeMap,
    SafeSet,
    type ChatIdentifier,
    type CommunityIdentifier,
    type Primitive,
    type ReadonlyMap,
} from "openchat-shared";
import { type UndoLocalUpdate } from "./undo";

export class LocalMap<K, V> {
    #addedOrUpdated: SafeMap<K, V>;
    #removed: SafeSet<K>;

    constructor(
        private serialiser?: (k: K) => Primitive,
        private deserialiser?: (p: Primitive) => K,
    ) {
        this.#addedOrUpdated = new SafeMap(serialiser, deserialiser);
        this.#removed = new SafeSet(serialiser, deserialiser);
    }

    // for testing
    protected addedOrUpdated(key: K): boolean {
        return this.#addedOrUpdated.has(key);
    }

    // for testing
    protected removed(key: K): boolean {
        return this.#removed.has(key);
    }

    // used for testing
    clear() {
        this.#addedOrUpdated.clear();
        this.#removed.clear();
    }

    addOrUpdate(key: K, value: V): UndoLocalUpdate {
        this.#addedOrUpdated.set(key, value);
        const removed = this.#removed.delete(key);
        return () => {
            this.#addedOrUpdated.delete(key);
            if (removed) {
                this.#removed.add(key);
            }
        };
    }

    remove(key: K) {
        this.#removed.add(key);
        const previous = this.#addedOrUpdated.get(key);
        this.#addedOrUpdated.delete(key);
        return () => {
            this.#removed.delete(key);
            if (previous) {
                this.#addedOrUpdated.set(key, previous);
            }
        };
    }

    apply(original: ReadonlyMap<K, V>): ReadonlyMap<K, V> {
        if (this.#addedOrUpdated.size === 0 && this.#removed.size === 0) return original;

        const merged = new SafeMap<K, V>(this.serialiser, this.deserialiser);
        for (const [k, v] of original) {
            merged.set(k, v);
        }
        this.#addedOrUpdated.forEach((v, k) => merged.set(k, v));
        this.#removed.forEach((k) => merged.delete(k));
        return merged;
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

export class LocalChatMap<V> extends LocalMap<ChatIdentifier, V> {
    constructor() {
        super(
            (id) => JSON.stringify(id),
            (k) => JSON.parse(String(k)) as ChatIdentifier,
        );
    }
}
