import {
    SafeMap,
    type ChatIdentifier,
    type CommunityIdentifier,
    type Primitive,
    type ReadonlyMap,
} from "openchat-shared";
import { type UndoLocalUpdate } from "./undo";

type Add<K, V> = { kind: "add"; key: K; value: V };
type Remove<K> = { kind: "remove"; key: K };
type Modification<K, V> = Add<K, V> | Remove<K>;

export class LocalMap<K, V> {
    #queue: Modification<K, V>[] = [];

    constructor(
        private serialiser?: (k: K) => Primitive,
        private deserialiser?: (p: Primitive) => K,
    ) {}

    // for testing
    protected addedOrUpdated(key: K): boolean {
        return this.#queue.find((m) => m.kind === "add" && m.key === key) !== undefined;
    }

    // for testing
    protected removed(key: K): boolean {
        return this.#queue.find((m) => m.kind === "remove" && m.key === key) !== undefined;
    }

    // used for testing
    clear() {
        this.#queue = [];
    }

    addOrUpdate(key: K, value: V): UndoLocalUpdate {
        const add: Add<K, V> = { kind: "add", key, value };
        this.#queue.push(add);
        return () => {
            this.#queue = this.#queue.filter((a) => a !== add);
        };
    }

    // This is very rarely needed - you probably don't need this
    undoRemove(key: K) {
        this.#queue = this.#queue.filter((m) => !(m.kind === "remove" && m.key === key));
        return () => {};
    }

    remove(key: K) {
        const remove: Remove<K> = { kind: "remove", key };
        this.#queue.push(remove);
        return () => {
            this.#queue = this.#queue.filter((a) => a !== remove);
        };
    }

    apply(original: ReadonlyMap<K, V>): ReadonlyMap<K, V> {
        if (this.#queue.length === 0) return original;

        const merged = new SafeMap<K, V>(this.serialiser, this.deserialiser);
        for (const [k, v] of original) {
            merged.set(k, v);
        }
        for (const mod of this.#queue) {
            if (mod.kind === "remove") {
                merged.delete(mod.key);
            }
            if (mod.kind === "add") {
                merged.set(mod.key, mod.value);
            }
        }
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
