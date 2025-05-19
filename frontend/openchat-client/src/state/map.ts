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
import type { Subscriber, Unsubscriber } from "svelte/store";
import { scheduleUndo, type UndoLocalUpdate } from "./undo";

export class LocalMapStore<K, V> {
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

    #subs: Subscriber<LocalMapStore<K, V>>[] = [];
    #publish() {
        this.#subs.forEach((sub) => {
            sub(this);
        });
    }

    subscribe(sub: Subscriber<LocalMapStore<K, V>>): Unsubscriber {
        this.#subs.push(sub);
        sub(this);
        return () => {
            this.#subs = this.#subs.filter((s) => s !== sub);
        };
    }

    // used for testing
    clear() {
        this.#addedOrUpdated.clear();
        this.#removed.clear();
        this.#publish();
    }

    addOrUpdate(key: K, value: V): UndoLocalUpdate {
        this.#addedOrUpdated.set(key, value);
        const removed = this.#removed.delete(key);
        this.#publish();
        return scheduleUndo(() => {
            this.#addedOrUpdated.delete(key);
            if (removed) {
                this.#removed.add(key);
            }
            this.#publish();
        });
    }

    remove(key: K) {
        this.#removed.add(key);
        const previous = this.#addedOrUpdated.get(key);
        this.#addedOrUpdated.delete(key);
        this.#publish();
        return scheduleUndo(() => {
            this.#removed.delete(key);
            if (previous) {
                this.#addedOrUpdated.set(key, previous);
            }
            this.#publish();
        });
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

export class LocalMap<K, V> {
    #addedOrUpdated: SafeMap<K, V>;
    #removed: SafeSet<K>;

    constructor(
        private serialiser?: (k: K) => Primitive,
        private deserialiser?: (p: Primitive) => K,
    ) {
        // TODO - when we are ready - make sure that this doesn't use SvelteMap
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

    // used for testing
    clear() {
        this.#addedOrUpdated.clear();
        this.#removed.clear();
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

export class ReactiveCommunityMap<V> extends SafeMap<CommunityIdentifier, V> {
    constructor() {
        super(
            (id) => id.communityId,
            (k) => ({ kind: "community", communityId: String(k) }),
            () => new SvelteMap(),
        );
    }
}

// This is a map that functions as a svelte store
export class SafeMapStore<K, V> extends SafeMap<K, V> {
    #subs: Subscriber<SafeMap<K, V>>[] = [];
    publish() {
        this.#subs.forEach((sub) => {
            sub(this);
        });
    }

    subscribe(sub: Subscriber<SafeMap<K, V>>): Unsubscriber {
        this.#subs.push(sub);
        sub(this);
        return () => {
            this.#subs = this.#subs.filter((s) => s !== sub);
        };
    }

    fromMap(map: ReadonlyMap<K, V>) {
        this.clear();
        for (const [k, v] of map) {
            super.set(k, v);
        }
        this.publish();
    }

    clear() {
        if (super.size > 0) {
            super.clear();
            this.publish();
        }
    }

    update(key: K, fn: (val: V) => V) {
        const val = this.get(key);
        if (val !== undefined) {
            this.set(key, fn(val));
        }
    }

    set(key: K, val: V) {
        super.set(key, val);
        this.publish();
        return this;
    }

    delete(key: K) {
        const deleted = super.delete(key);
        if (deleted) {
            this.publish();
        }
        return deleted;
    }
}

export class CommunityMapStore<V> extends SafeMapStore<CommunityIdentifier, V> {
    constructor() {
        super(
            (id) => id.communityId,
            (k) => ({ kind: "community", communityId: String(k) }),
        );
    }
}

export class MessageMapStore<V> extends SafeMapStore<bigint, V> {
    constructor() {
        super(
            (k) => k.toString(),
            (k) => BigInt(k),
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

export class LocalCommunityMapStore<V> extends LocalMapStore<CommunityIdentifier, V> {
    constructor() {
        super(
            (id) => id.communityId,
            (k) => ({ kind: "community", communityId: String(k) }),
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
