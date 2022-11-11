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

    applyUpdate(
        key: string,
        updateFn: (current: T) => Partial<T>
    ): void {
        this.store.update((state) => {
            const updates = state[key];
            state[key] = {
                ...updates,
                ...updateFn(updates),
                lastUpdated: Date.now(),
            };
            return state;
        });
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
