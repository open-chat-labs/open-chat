/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { derived, get, Readable, writable, Writable } from "svelte/store";
import { selectedChatId } from "./chat";

function setDataForChat<T>(store: Writable<Record<string, T>>, chatId: string, data: T): void {
    store.update((s) => {
        s[chatId] = data;
        return s;
    });
}

function updateDataForChat<T>(
    store: Writable<Record<string, T>>,
    chatId: string,
    fn: (events: T) => T,
    empty: T
): void {
    store.update((s) => {
        s[chatId] = fn(s[chatId] ?? empty);
        return s;
    });
}

export type UpdatableChatStore<T> = {
    update: (chatId: string, fn: (data: T) => T) => void;
    set: (chatId: string, data: T) => void;
};

export function createChatSpecificObjectStore<T extends Record<string, unknown>>(init: () => T) {
    const all: Writable<Record<string, T>> = writable<Record<string, T>>({});
    const byChat: Readable<T> = derived([selectedChatId, all], ([$selectedChatId, $all]) => {
        if ($selectedChatId === undefined) return init();
        return $all[$selectedChatId] ?? init();
    });
    return {
        all,
        subscribe: byChat.subscribe,
        get: (chatId: string): T => get(all)[chatId] ?? init(),
        update: (chatId: string, fn: (data: T) => T) => updateDataForChat(all, chatId, fn, init()),
        set: (chatId: string, data: T) => setDataForChat(all, chatId, data),
        clear: (chatId: string): void => setDataForChat(all, chatId, init()),
        getProp: <P extends keyof T>(chatId: string, prop: P) => (get(all)[chatId] ?? init())[prop],
        updateProp: <P extends keyof T>(
            chatId: string,
            prop: P,
            updateFn: (data: T[P]) => T[P]
        ) => {
            updateDataForChat(
                all,
                chatId,
                (data) => {
                    if (data !== undefined) {
                        data[prop] = updateFn(data[prop]);
                        return data;
                    }
                    return data;
                },
                init()
            );
        },
        setProp: <P extends keyof T>(chatId: string, prop: P, value: T[P]) => {
            updateDataForChat(
                all,
                chatId,
                (data) => {
                    if (data !== undefined) {
                        data[prop] = value;
                        return data;
                    }
                    return data;
                },
                init()
            );
        },
    };
}

export function createDerivedPropStore<S, P extends keyof S>(
    store: Readable<S | undefined>,
    prop: P,
    empty: () => S[P],
    eq: (current: S[P], next: S[P]) => boolean = (current: S[P], next: S[P]) => current === next
): Readable<S[P]> {
    const storeVal = get(store);
    let initialised = false;
    let currentValue: S[P] = storeVal ? storeVal[prop] : empty();
    return derived(store, ($store, set) => {
        const nextValue: S[P] = $store ? $store[prop] : empty();
        if (!eq(currentValue, nextValue) || !initialised) {
            set(nextValue);
        }
        currentValue = nextValue;
        initialised = true;
    });
}
