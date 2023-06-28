import { writable } from "svelte/store";
import { createSetStore } from "./setStore";
import { EventWrapper, Message, MessageContext, MessageContextMap } from "openchat-shared";
import { revokeObjectUrls } from "../utils/chat";

export type UnconfirmedState = {
    messages: EventWrapper<Message>[];
    messageIds: Set<bigint>;
};

export type UnconfirmedMessages = MessageContextMap<UnconfirmedState>;

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
function createUnconfirmedReadByThemStore() {
    return createSetStore(writable(new Set<bigint>()));
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
function createUnconfirmedStore() {
    const store = writable<UnconfirmedMessages>(new MessageContextMap<UnconfirmedState>());
    let storeValue: UnconfirmedMessages = new MessageContextMap<UnconfirmedState>();
    store.subscribe((v) => (storeValue = v));

    function pruneOldMessages(): void {
        if (storeValue.size > 0) {
            const oneMinuteAgo = BigInt(Date.now() - 60000);
            store.update((state) => {
                return state.entries().reduce((result, [key, { messages }]) => {
                    return applyUpdateToState(
                        result,
                        key,
                        removeWhere(messages, (m) => m.timestamp < oneMinuteAgo)
                    );
                }, new MessageContextMap<UnconfirmedState>());
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
        keyUpdated: MessageContext,
        messages: EventWrapper<Message>[]
    ): UnconfirmedMessages {
        if (messages.length === 0) {
            state.delete(keyUpdated);
            return state;
        }
        state.set(keyUpdated, {
            messages,
            messageIds: new Set<bigint>(messages.map((m) => m.event.messageId)),
        });
        return state;
    }

    // Remove old messages every 30 seconds
    window.setInterval(pruneOldMessages, 30000);

    return {
        subscribe: store.subscribe,
        getMessages: (key: MessageContext): EventWrapper<Message>[] => {
            return storeValue.get(key)?.messages ?? [];
        },
        add: (key: MessageContext, message: EventWrapper<Message>): void => {
            store.update((state) => {
                const messages = [...(state.get(key)?.messages ?? []), message];
                return applyUpdateToState(state, key, messages);
            });
        },
        contains: (key: MessageContext, messageId: bigint): boolean => {
            return storeValue.get(key)?.messageIds.has(messageId) ?? false;
        },
        delete: (key: MessageContext, messageId: bigint): boolean => {
            if (storeValue.get(key)?.messageIds.has(messageId)) {
                store.update((state) => {
                    const messages = removeWhere(
                        state.get(key)?.messages ?? [],
                        (m) => m.event.messageId === messageId
                    );
                    return applyUpdateToState(state, key, messages);
                });
                return true;
            }
            return false;
        },
        clear: (initialVal: UnconfirmedMessages = {} as UnconfirmedMessages): void =>
            store.set(initialVal),
    };
}

export const unconfirmedReadByThem = createUnconfirmedReadByThemStore();

export const unconfirmed = createUnconfirmedStore();
