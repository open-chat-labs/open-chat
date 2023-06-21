import type { ISafeMap } from "openchat-shared";
import { Writable, writable } from "svelte/store";

const PRUNE_LOCAL_UPDATES_INTERVAL: number = 30 * 1000;

export interface LocalUpdates {
    lastUpdated: number;
}

export abstract class LocalUpdatesStore<K, T extends LocalUpdates> {
    private store: Writable<ISafeMap<K, T>>;
    private storeValue: ISafeMap<K, T>;

    subscribe: typeof this.store.subscribe;

    constructor(initialValue: ISafeMap<K, T>) {
        this.store = writable<ISafeMap<K, T>>(initialValue);
        this.storeValue = initialValue;
        this.store.subscribe((value) => (this.storeValue = value));
        this.subscribe = this.store.subscribe;

        window.setInterval(() => this.pruneLocalUpdates(), PRUNE_LOCAL_UPDATES_INTERVAL);
    }

    protected applyUpdate(key: K, updateFn: (current: T) => Partial<T>): void {
        this.store.update((state) => {
            const current = (state.get(key) ?? { lastUpdated: Date.now() }) as T;
            state.set(key, {
                ...current,
                ...updateFn(current),
            });
            return state;
        });
    }

    protected deleteKey(key: K): void {
        if (this.storeValue.has(key)) {
            this.store.update((state) => {
                state.delete(key);
                return state;
            });
        }
    }

    private pruneLocalUpdates(): void {
        const now = Date.now();

        let updated = false;
        const newStoreValue = this.storeValue.entries().reduce((result, [key, updates]) => {
            // Only keep updates which are < 30 seconds old
            if (now - updates.lastUpdated < 30 * 1000) {
                result.set(key, updates);
            } else {
                updated = true;
            }
            return result;
        }, this.storeValue.empty());

        if (updated) {
            this.store.set(newStoreValue);
        }
    }
}
