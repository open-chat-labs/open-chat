import { chatIdentifiersEqual, type ChatIdentifier } from "openchat-shared";
import { immutableStore } from "./immutable";
import { get } from "svelte/store";

export const pinnedChatsStore = createStore();

function createStore() {
    const store = immutableStore<ChatIdentifier[]>([]);
    return {
        subscribe: store.subscribe,
        set: store.set,
        includes: (chatId: ChatIdentifier): boolean => {
            return get(store).find((id) => chatIdentifiersEqual(id, chatId)) !== undefined;
        },
        pin: (chatId: ChatIdentifier): void => {
            store.update((ids) => {
                if (!ids.find((id) => chatIdentifiersEqual(id, chatId))) {
                    const ids_clone = [chatId, ...ids];
                    return ids_clone;
                }
                return ids;
            });
        },
        unpin: (chatId: ChatIdentifier): void => {
            store.update((ids) => {
                const index = ids.findIndex((id) => chatIdentifiersEqual(id, chatId));
                if (index >= 0) {
                    const ids_clone = [...ids];
                    ids_clone.splice(index, 1);
                    return ids_clone;
                }
                return ids;
            });
        },
    };
}
