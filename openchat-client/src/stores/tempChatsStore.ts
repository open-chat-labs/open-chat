import type { Readable } from "svelte/store";
import { immutableStore } from "./immutable";

export const mutedChatsStore = createTempChatsStore<boolean>();
export const archivedChatsStore = createTempChatsStore<boolean>();

export interface TempChatsStore<T> extends Readable<Map<string, T>> {
    set(this: void, chatId: string, value: T): void;
}

export function createTempChatsStore<T>(): TempChatsStore<T> {
    const DELETE_LOCAL_VALUE_INTERVAL = 60000;
    const timers: Map<string, number> = new Map();
    const store = immutableStore<Map<string, T>>(new Map());

    function updateStore(chatId: string, value: T) {
        store.update((map) => {
            const clone = new Map(map);
            clone.set(chatId, value);
            return clone;
        });
    }

    function deleteFromStore(chatId: string) {
        store.update((map) => {
            const clone = new Map(map);
            clone.delete(chatId);
            return clone;
        });
    }

    return {
        subscribe: store.subscribe,
        set: (chatId: string, value: T) => {
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
                deleteFromStore(chatId);
            }, DELETE_LOCAL_VALUE_INTERVAL);
            timers.set(chatId, newTimer);

            updateStore(chatId, value);
        },
    };
}
