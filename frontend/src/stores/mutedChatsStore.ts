import { immutableStore } from "./immutable";

export const mutedChatsStore = createStore();

function createStore() {
    const DELETE_LOCAL_VALUE_INTERVAL = 60000;
    const timers: Map<string, number> = new Map();
    const store = immutableStore<Map<string, boolean>>(new Map());
    return {
        subscribe: store.subscribe,
        toggle: (chatId: string, mute: boolean) => {
            // Remove any existing timer for this chatId
            const existingTimer = timers.get(chatId);
            if (existingTimer !== undefined) {
                window.clearTimeout(existingTimer);
                timers.delete(chatId);
            }

            // Create a new timer to remove the entry for this
            // chatId after 1 minute.
            const newTimer = window.setTimeout(() => {
                timers.delete(chatId);
                mutedChatsStore.delete(chatId);
            }, DELETE_LOCAL_VALUE_INTERVAL);
            timers.set(chatId, newTimer);

            // Update the store
            store.update((map) => {
                const clone = new Map(map);
                clone.set(chatId, mute);
                return clone;
            });
        },
        delete: (chatId: string) => {
            store.update((map) => {
                const clone = new Map(map);
                clone.delete(chatId);
                return clone;
            });
        },
    };
}
