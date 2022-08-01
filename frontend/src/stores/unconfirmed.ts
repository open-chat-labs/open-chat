import { get, writable } from "svelte/store";
import { createSetStore } from "./setStore";
import type { EventWrapper, Message } from "../domain/chat/chat";

export type UnconfirmedMessages = Record<
    string,
    { messages: EventWrapper<Message>[]; messageIds: Set<bigint> }
>;

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
function createUnconfirmedReadByThemStore() {
    return createSetStore(writable(new Set<bigint>()));
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
function createUnconfirmedStore() {
    const store = writable<UnconfirmedMessages>({} as UnconfirmedMessages);

    return {
        subscribe: store.subscribe,
        getMessages: (key: string): EventWrapper<Message>[] => {
            return get(store)[key]?.messages ?? [];
        },
        add: (key: string, message: EventWrapper<Message>): void => {
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
        contains: (key: string, messageId: bigint): boolean => {
            return get(store)[key]?.messageIds.has(messageId) ?? false;
        },
        delete: (key: string, messageId: bigint): boolean => {
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
        clear: (): void => store.set({} as UnconfirmedMessages),
    };
}

export const unconfirmedReadByThem = createUnconfirmedReadByThemStore();

export const unconfirmed = createUnconfirmedStore();
