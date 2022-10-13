import { immutableStore } from "./immutable";

export const pinnedChatsStore = createStore();

function createStore() {
    const store = immutableStore<string[]>([]);
    return {
        subscribe: store.subscribe,
        set: store.set,
        pin: (chat_id: string): void => {
            store.update((ids) => {
                if (!ids.includes(chat_id)) {
                    const ids_clone = [...ids];
                    ids_clone.unshift(chat_id);
                    return ids_clone;
                }
                return ids;
            });
        },
        unpin: (chat_id: string): void => {
            store.update((ids) => {
                const index = ids.indexOf(chat_id);
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
