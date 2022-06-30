import type { Writable } from "svelte/store";
import { get, writable } from "svelte/store";

const initialValue: string[] = [];
const store = writable(initialValue);
export const pinnedChatsStore = {
    ...createStore(store),
};

function createStore(store: Writable<string[]>) {
    return {
        subscribe: store.subscribe,
        set: store.set,
        pin: (chat_id: string): boolean => {
            if (!get(store).includes(chat_id)) {
                store.update((ids) => {
                    ids.unshift(chat_id);
                    return [...ids];
                });
                return true;
            }
            return false;
        },
        unpin: (chat_id: string): boolean => {
            const index = get(store).indexOf(chat_id);
            if (index >= 0) {
                store.update((ids) => {
                    ids.splice(index, 1);
                    return [...ids];
                });
                return true;
            }
            return false;
        },
    };
}
