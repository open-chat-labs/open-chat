/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { derived, get, Writable } from "svelte/store";
import { selectedChatStore } from "./chat";
import { immutableStore } from "./immutable";

function setDataForChat<T>(store: Writable<Record<string, T>>, chatId: string, data: T): void {
    store.update((s) => ({
        ...s,
        [chatId]: data,
    }));
}

function updateDataForChat<T>(
    store: Writable<Record<string, T>>,
    chatId: string,
    fn: (events: T) => T,
    empty: T
): void {
    store.update((s) => ({
        ...s,
        [chatId]: fn(s[chatId] ?? empty),
    }));
}

export function createChatSpecificStore<T>(empty: T) {
    const all: Writable<Record<string, T>> = immutableStore<Record<string, T>>({});
    const byChat = derived([selectedChatStore, all], ([$selectedChat, $all]) => {
        if ($selectedChat === undefined) return empty;
        return $all[$selectedChat.chatId] ?? empty;
    });
    return {
        subscribe: byChat.subscribe,
        get: (): T => get(byChat),
        update: (chatId: string, fn: (events: T) => T) => updateDataForChat(all, chatId, fn, empty),
        set: (chatId: string, data: T) => setDataForChat(all, chatId, data),
        clear: (chatId: string): void => setDataForChat(all, chatId, empty),
    };
}
