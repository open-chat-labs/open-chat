import { writable } from "svelte/store";
import { createSetStore } from "./setStore";
import type { EventWrapper, Message } from "openchat-shared";
import { revokeObjectUrls } from "../utils/chat";

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
    let storeValue: UnconfirmedMessages = {};
    store.subscribe((v) => (storeValue = v));

    function pruneOldMessages(): void {
        if (Object.keys(storeValue).length > 0) {
            const oneMinuteAgo = BigInt(Date.now() - 60000);
            store.update((state) => {
                return Object.entries(state).reduce((result, [key, { messages }]) => {
                    return applyUpdateToState(
                        result,
                        key,
                        removeWhere(messages, (m) => m.timestamp < oneMinuteAgo)
                    );
                }, {} as UnconfirmedMessages);
            });
        }
    }

    function removeWhere(
        messages: EventWrapper<Message>[],
        predicate: (message: EventWrapper<Message>) => boolean
    ): EventWrapper<Message>[] {
        return messages.filter((m) => {
            if (predicate(m)) {
                revokeObjectUrls(m);
                return false;
            }
            return true;
        });
    }

    function applyUpdateToState(
        state: UnconfirmedMessages,
        keyUpdated: string,
        messages: EventWrapper<Message>[]
    ): UnconfirmedMessages {
        if (messages.length === 0) {
            // Remove the key from the state
            const { [keyUpdated]: _, ...withKeyRemoved } = state;
            return withKeyRemoved;
        }
        return {
            ...state,
            [keyUpdated]: {
                messages,
                messageIds: new Set<bigint>(messages.map((m) => m.event.messageId)),
            },
        };
    }

    // Remove old messages every 30 seconds
    window.setInterval(pruneOldMessages, 30000);

    return {
        subscribe: store.subscribe,
        getMessages: (key: string): EventWrapper<Message>[] => {
            return storeValue[key]?.messages ?? [];
        },
        add: (key: string, message: EventWrapper<Message>): void => {
            store.update((state) => {
                const chatEvents = state[key] ?? {};
                const messages = [...(chatEvents.messages ?? []), message];
                return applyUpdateToState(state, key, messages);
            });
        },
        contains: (key: string, messageId: bigint): boolean => {
            return storeValue[key]?.messageIds.has(messageId) ?? false;
        },
        delete: (key: string, messageId: bigint): boolean => {
            if (storeValue[key]?.messageIds.has(messageId)) {
                store.update((state) => {
                    const chatEvents = state[key] ?? {};
                    const messages = removeWhere(
                        chatEvents.messages ?? [],
                        (m) => m.event.messageId === messageId
                    );
                    return applyUpdateToState(state, key, messages);
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
