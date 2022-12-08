import { writable } from "svelte/store";

const PRUNE_LOCAL_UPDATES_INTERVAL: number = 30 * 1000;

export interface LocalUpdates {
    lastUpdated: number
}

export abstract class LocalUpdatesStore<T extends LocalUpdates> {
    private store = writable<Record<string, T>>({});
    private storeValue: Record<string, T> = {};

    constructor() {
        this.store.subscribe(value => this.storeValue = value);

        window.setInterval(() => this.pruneLocalUpdates(), PRUNE_LOCAL_UPDATES_INTERVAL);
    }

    subscribe = this.store.subscribe;

    protected applyUpdate(
        key: string,
        updateFn: (current: T) => Partial<T>
    ): void {
        this.store.update((state) => {
            const current = state[key];
            state[key] = {
                ...current,
                ...updateFn(current),
                lastUpdated: Date.now(),
            };
            return state;
        });
    }

    protected deleteKey(key: string): void {
        if (this.storeValue[key] !== undefined) {
            this.store.update((state) => {
                const clone = { ...state };
                delete clone[key];
                return clone;
            });
        }
    }

    private pruneLocalUpdates(): void {
        const now = Date.now();

        let updated = false;
        const newStoreValue = Object.entries(this.storeValue).reduce((result, [key, updates]) => {
            // Only keep updates which are < 30 seconds old
            if (now - updates.lastUpdated < 30 * 1000) {
                result[key] = updates;
            } else {
                updated = true;
            }
            return result;
        }, {} as Record<string, T>)

        if (updated) {
            this.store.set(newStoreValue);
        }
    }
}
