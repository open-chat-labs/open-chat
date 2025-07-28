import { type Subscriber, writable } from "svelte/store";

const TWO_MINUTES_MILLIS = 120 * 1000;

type LastOnline = {
    lastOnline: number;
    updated: number;
};

function createLastOnlineDatesStore() {
    const store = writable<Map<string, LastOnline>>(new Map<string, LastOnline>());
    let storeValue = new Map<string, LastOnline>();
    store.subscribe((v) => (storeValue = v));

    function expired(lastOnline: LastOnline, now: number): boolean {
        return now - lastOnline.updated > TWO_MINUTES_MILLIS;
    }

    return {
        subscribe: (subscriber: Subscriber<Map<string, LastOnline>>, invalidate?: () => void) => store.subscribe(subscriber, invalidate),
        get: (userId: string, now: number): LastOnline | undefined => {
            const value = storeValue.get(userId);
            return value !== undefined && !expired(value, now) ? value : undefined;
        },
        set: (values: Iterable<[string, number]>, now: number): void => {
            store.update((map) => {
                const newMap = new Map<string, LastOnline>();
                for (const [userId, lastOnline] of map) {
                    if (!expired(lastOnline, now)) {
                        newMap.set(userId, lastOnline);
                    }
                }
                for (const [userId, lastOnline] of values) {
                    const current = newMap.get(userId);
                    if (current === undefined || current.lastOnline < lastOnline) {
                        newMap.set(userId, { lastOnline, updated: now });
                    }
                }
                return newMap;
            });
        },
    };
}

export const lastOnlineDates = createLastOnlineDatesStore();
