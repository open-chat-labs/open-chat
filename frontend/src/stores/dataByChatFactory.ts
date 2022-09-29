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
        get: (chatId: string): T => get(all)[chatId] ?? init(),
        getProp: <P extends keyof T>(chatId: string, prop: P) => (get(all)[chatId] ?? init())[prop],
        update: (chatId: string, fn: (data: T) => T) => updateDataForChat(all, chatId, fn, init()),
        set: (chatId: string, data: T) => setDataForChat(all, chatId, data),
        clear: (chatId: string): void => setDataForChat(all, chatId, init()),
    };
}

export function createNullableChatSpecificDateStore<T>() {
    const store = createChatSpecificDataStore<T | undefined>(undefined);
    return {
        subscribe: store.subscribe,
        get: (chatId: string): T | undefined => store.get(chatId),
        getProp: <P extends keyof T>(chatId: string, prop: P) => {
            const val = store.get(chatId);
            if (val) {
                return val[prop];
            }
            return undefined;
        },
        update: (chatId: string, fn: (data: T) => T) =>
            store.update(chatId, (data) => (data ? fn(data) : undefined)),
        set: (chatId: string, data: T) => store.set(chatId, data),
        clear: (chatId: string): void => store.clear(chatId),
    };
}

export function createDerivedPropStore<S, P extends keyof S>(
    store: Readable<S | undefined>,
    prop: P,
    empty: S[P]
): Readable<S[P]> {
    const storeVal = get(store);
    let initialised = false;
    let currentValue: S[P] = storeVal ? storeVal[prop] : empty;
    return derived(store, ($store, set) => {
        const nextValue: S[P] = $store ? $store[prop] : empty;
        if (nextValue !== currentValue || !initialised) {
            set(nextValue);
        }
        currentValue = nextValue;
        initialised = true;
    });
}
