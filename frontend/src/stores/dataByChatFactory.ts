/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { derived, get, Readable, Writable } from "svelte/store";
import { selectedChatId } from "./chat";
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

export function createChatSpecificDataStore<T>(empty: T, initFn?: () => T) {
    function init() {
        return initFn ? initFn() : empty;
    }
    const all: Writable<Record<string, T>> = immutableStore<Record<string, T>>({});
    const byChat: Readable<T> = derived([selectedChatId, all], ([$selectedChatId, $all]) => {
        if ($selectedChatId === undefined) return init();
        return $all[$selectedChatId] ?? init();
    });
    return {
        subscribe: byChat.subscribe,
        get: (): T => get(byChat),
        update: (chatId: string, fn: (data: T) => T) => updateDataForChat(all, chatId, fn, init()),
        set: (chatId: string, data: T) => setDataForChat(all, chatId, data),
        clear: (chatId: string): void => setDataForChat(all, chatId, init()),
    };
}
