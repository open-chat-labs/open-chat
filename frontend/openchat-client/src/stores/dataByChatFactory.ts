/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { derived, get, Readable, writable, Writable } from "svelte/store";
import { selectedChatId } from "./chat";
import { type ChatIdentifier, ChatMap } from "openchat-shared";

function setDataForChat<T>(store: Writable<ChatMap<T>>, chatId: ChatIdentifier, data: T): void {
    store.update((s) => {
        s.set(chatId, data);
        return s;
    });
}

function updateDataForChat<T>(
    store: Writable<ChatMap<T>>,
    chatId: ChatIdentifier,
    fn: (events: T) => T,
    empty: T
): void {
    store.update((s) => {
        s.set(chatId, fn(s.get(chatId) ?? empty));
        return s;
    });
}

export type UpdatableChatStore<T> = {
    update: (chatId: string, fn: (data: T) => T) => void;
    set: (chatId: string, data: T) => void;
};

export function createChatSpecificObjectStore<T extends Record<string, unknown>>(init: () => T) {
    const all: Writable<ChatMap<T>> = writable<ChatMap<T>>(new ChatMap());
    const byChat: Readable<T> = derived([selectedChatId, all], ([$selectedChatId, $all]) => {
        if ($selectedChatId === undefined) return init();
        return $all.get($selectedChatId) ?? init();
    });
    return {
        all,
        subscribe: byChat.subscribe,
        get: (chatId: ChatIdentifier): T => get(all).get(chatId) ?? init(),
        update: (chatId: ChatIdentifier, fn: (data: T) => T) =>
            updateDataForChat(all, chatId, fn, init()),
        set: (chatId: ChatIdentifier, data: T) => setDataForChat(all, chatId, data),
        clear: (chatId: ChatIdentifier): void => setDataForChat(all, chatId, init()),
        getProp: <P extends keyof T>(chatId: ChatIdentifier, prop: P) =>
            (get(all).get(chatId) ?? init())[prop],
        updateProp: <P extends keyof T>(
            chatId: ChatIdentifier,
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
        setProp: <P extends keyof T>(chatId: ChatIdentifier, prop: P, value: T[P]) => {
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
