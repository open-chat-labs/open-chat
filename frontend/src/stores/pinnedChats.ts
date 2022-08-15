import { get } from "svelte/store";
import { immutableStore } from "./immutable";

export const pinnedChatsStore = createStore();

function createStore() {
    const store = immutableStore<string[]>([]);
    return {
        subscribe: store.subscribe,
        set: store.set,
        pin: (chat_id: string): boolean => {
            if (!get(store).includes(chat_id)) {
                store.update((ids) => {
                    const ids_clone = [...ids];
                    ids_clone.unshift(chat_id);
                    return ids_clone;
                });
                return true;
            }
            return false;
        },
        unpin: (chat_id: string): boolean => {
            const index = get(store).indexOf(chat_id);
            if (index >= 0) {
                store.update((ids) => {
                    const ids_clone = [...ids];
                    ids_clone.splice(index, 1);
                    return ids_clone;
                });
                return true;
            }
            return false;
        },
    };
}
