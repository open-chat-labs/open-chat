import { writable } from "svelte/store";

export type LocalPinnedByChat = Record<string, Set<number>>;

const store = writable<LocalPinnedByChat>({});

export const localPinned = {
    subscribe: store.subscribe,
    pin: (chatId: string, messageIndex: number): void => {
        console.log("Pinned message: ", chatId, messageIndex);
        store.update((s) => {
            if (s[chatId] === undefined) {
                s[chatId] = new Set<number>();
            }
            s[chatId].add(messageIndex);
            return { ...s };
        });
    },
    unpin: (chatId: string, messageIndex: number): void => {
        console.log("Unpinned message: ", chatId, messageIndex);
        store.update((s) => {
            s[chatId]?.delete(messageIndex);
            return { ...s };
        });
    },
};
