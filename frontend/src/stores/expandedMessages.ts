import { writable } from "svelte/store";

const store = writable<Set<bigint>>();

export const expandedMessages = {
    subscribe: store.subscribe,
    toggle: (messageId: bigint): void =>
        store.update((s) => {
            if (s.has(messageId)) {
                s.delete(messageId);
            } else {
                s.add(messageId);
            }
            return new Set(s);
        }),
};
