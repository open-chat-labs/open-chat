import type { ChatIdentifier } from "openchat-shared";
import { immutableStore } from "./immutable";

export const pinnedChatsStore = createStore();

function createStore() {
    const store = immutableStore<string[]>([]);
    return {
        subscribe: store.subscribe,
        set: store.set,
        pin: (chatId: ChatIdentifier): void => {
            const key = chatId.toString();
            store.update((ids) => {
                if (!ids.includes(key)) {
                    const ids_clone = [...ids];
                    ids_clone.unshift(key);
                    return ids_clone;
                }
                return ids;
            });
        },
        unpin: (chatId: ChatIdentifier): void => {
            store.update((ids) => {
                const index = ids.indexOf(chatId.toString());
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
