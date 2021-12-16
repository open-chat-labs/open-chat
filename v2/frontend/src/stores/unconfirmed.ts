import { get, writable } from "svelte/store";
import { createSetStore } from "./setStore";
import type { EventWrapper, Message } from "../domain/chat/chat";

type UnconfirmedMessagesByChat = Record<
    string,
    { messages: EventWrapper<Message>[]; messageIds: Set<bigint> }
>;

const store = writable<UnconfirmedMessagesByChat>({});

export const unconfirmedReadByThem = createSetStore(writable(new Set<bigint>()));
export const unconfirmed = {
    subscribe: store.subscribe,
    getMessages: (chatId: string): EventWrapper<Message>[] => {
        return get(store)[chatId]?.messages ?? [];
    },
    add: (chatId: string, message: EventWrapper<Message>): void => {
        store.update((state) => {
            let chatEvents = state[chatId];
            if (chatEvents === undefined) {
                chatEvents = {
                    messages: [],
                    messageIds: new Set<bigint>(),
                };
                state[chatId] = chatEvents;
            }
            chatEvents.messages.push(message);
            chatEvents.messageIds.add(message.event.messageId);
            return {
                ...state,
                [chatId]: chatEvents,
            };
        });
    },
    contains: (chatId: string, messageId: bigint): boolean => {
        return get(store)[chatId]?.messageIds.has(messageId) ?? false;
    },
    delete: (chatId: string, messageId: bigint): boolean => {
        if (get(store)[chatId]?.messageIds.has(messageId)) {
            store.update((state) => {
                const chatEvents = state[chatId];
                if (chatEvents?.messageIds.delete(messageId)) {
                    return {
                        ...state,
                        [chatId]: {
                            messages: chatEvents.messages.filter(
                                (e) => e.event.messageId !== messageId
                            ),
                            messageIds: chatEvents.messageIds,
                        },
                    };
                }
                return state;
            });
            return true;
        }
        return false;
    },
    clear: (): void => store.set({}),
};
