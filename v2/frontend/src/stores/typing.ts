import { writable } from "svelte/store";

type TypersByChat = Record<string, Set<string>>;

const store = writable<TypersByChat>({});

export const typing = {
    subscribe: store.subscribe,
    add: (chatId: string, userId: string): void =>
        store.update((chats) => {
            if (chats[chatId] === undefined) {
                chats[chatId] = new Set<string>();
            }
            chats[chatId].add(userId);
            return {
                ...chats,
            };
        }),
    delete: (chatId: string, userId: string): void =>
        store.update((chats) => {
            chats[chatId]?.delete(userId);
            return {
                ...chats,
            };
        }),
};
