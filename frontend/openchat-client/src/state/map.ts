import {
    SafeMap,
    SafeSet,
    type ChatIdentifier,
    type CommunityIdentifier,
    type MessageContext,
    type Primitive,
    type ReadonlyMap,
} from "openchat-shared";
import { SvelteMap, SvelteSet } from "svelte/reactivity";
import { scheduleUndo, type UndoLocalUpdate } from "./undo";

export class LocalMap<K, V> {
    #addedOrUpdated: SafeMap<K, V>;
    #removed: SafeSet<K>;

    constructor(
        private serialiser?: (k: K) => Primitive,
        private deserialiser?: (p: Primitive) => K,
    ) {
        this.#addedOrUpdated = new SafeMap(serialiser, deserialiser, () => new SvelteMap());
        this.#removed = new SafeSet(serialiser, deserialiser, () => new SvelteSet());
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

export class ReactiveCommunityMap<V> extends SafeMap<CommunityIdentifier, V> {
    constructor() {
        super(
            (id) => id.communityId,
            (k) => ({ kind: "community", communityId: String(k) }),
            () => new SvelteMap(),
        );
    }
}

export class ReactiveMessageMap<V> extends SafeMap<bigint, V> {
    constructor() {
        super(
            (k) => k.toString(),
            (k) => BigInt(k),
            () => new SvelteMap(),
        );
    }
}

export class ReactiveChatMap<V> extends SafeMap<ChatIdentifier, V> {
    constructor() {
        super(
            (id) => JSON.stringify(id),
            (k) => JSON.parse(String(k)) as ChatIdentifier,
            () => new SvelteMap(),
        );
    }
}

export class ReactiveMessageContextMap<V> extends SafeMap<MessageContext, V> {
    constructor() {
        super(
            (k) => JSON.stringify(k),
            (k) => JSON.parse(String(k)) as MessageContext,
            () => new SvelteMap(),
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

export class LocalChatMap<V> extends LocalMap<ChatIdentifier, V> {
    constructor() {
        super(
            (id) => JSON.stringify(id),
            (k) => JSON.parse(String(k)) as ChatIdentifier,
        );
    }
}
