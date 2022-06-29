import { get, writable } from "svelte/store";
import { createSetStore } from "./setStore";
import type { EventWrapper, Message } from "../domain/chat/chat";

type KeyType = string | number | symbol;
type UnconfirmedMessagesByKey<T extends KeyType> = Record<
    T,
    { messages: EventWrapper<Message>[]; messageIds: Set<bigint> }
>;

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createUnconfirmedReadByThemStore() {
    return createSetStore(writable(new Set<bigint>()));
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createUnconfirmedStore<T extends KeyType>() {
    const store = writable<UnconfirmedMessagesByKey<T>>({} as UnconfirmedMessagesByKey<T>);

    return {
        subscribe: store.subscribe,
        getMessages: (key: T): EventWrapper<Message>[] => {
            return get(store)[key]?.messages ?? [];
        },
        add: (key: T, message: EventWrapper<Message>): void => {
            store.update((state) => {
                const chatEvents = state[key];
                return {
                    ...state,
                    [key]: {
                        messages: [...(chatEvents?.messages ?? []), message],
                        messageIds: new Set<bigint>([
                            ...(chatEvents?.messageIds ?? []),
                            message.event.messageId,
                        ]),
                    },
                };
            });
        },
        contains: (key: T, messageId: bigint): boolean => {
            return get(store)[key]?.messageIds.has(messageId) ?? false;
        },
        delete: (key: T, messageId: bigint): boolean => {
            if (get(store)[key]?.messageIds.has(messageId)) {
                store.update((state) => {
                    const chatEvents = state[key];
                    const messageIds = new Set<bigint>([...(chatEvents?.messageIds ?? [])]);
                    if (messageIds.delete(messageId)) {
                        return {
                            ...state,
                            [key]: {
                                messages: chatEvents.messages.filter(
                                    (e) => e.event.messageId !== messageId
                                ),
                                messageIds,
                            },
                        };
                    }
                    return state;
                });
                return true;
            }
            return false;
        },
        clear: (): void => store.set({} as UnconfirmedMessagesByKey<T>),
    };
}
