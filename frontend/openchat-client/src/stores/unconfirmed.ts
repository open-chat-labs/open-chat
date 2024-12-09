import { writable } from "svelte/store";
import { createSetStore } from "./setStore";
import {
    type EventWrapper,
    type Message,
    type MessageContext,
    MessageContextMap,
} from "openchat-shared";
import { recentlySentMessagesStore } from "./recentlySentMessages";

export type UnconfirmedState = {
    messages: EventWrapper<Message>[];
    messageIds: Map<bigint, boolean>;
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
                return state.entries().reduce((result, [key, s]) => {
                    const newState = filterMessages(s, (m) => m.timestamp > oneMinuteAgo);
                    if (newState.messageIds.size > 0) {
                        result.set(key, newState);
                    }
                    return result;
                }, new MessageContextMap<UnconfirmedState>());
            });
        }
    }

    function filterMessages(
        state: UnconfirmedState,
        predicate: (message: EventWrapper<Message>) => boolean,
    ): UnconfirmedState {
        state.messages = state.messages.filter((message) => {
            if (predicate(message)) {
                return true;
            } else {
                revokeObjectUrls(message);
                state.messageIds.delete(message.event.messageId);
                return false;
            }
        });
        return state;
    }

    function emptyState(): UnconfirmedState {
        return {
            messages: [],
            messageIds: new Map<bigint, boolean>(),
        };
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
                const s = state.get(key) ?? emptyState();
                if (!s.messageIds.has(message.event.messageId)) {
                    s.messages.push(message);
                    s.messageIds.set(message.event.messageId, false);
                    state.set(key, s);
                }
                return state;
            });
            recentlySentMessagesStore.insert(message.event.messageId, message.timestamp);
        },
        contains: (key: MessageContext, messageId: bigint): boolean => {
            return storeValue.get(key)?.messageIds.has(messageId) ?? false;
        },
        markAccepted: (key: MessageContext, messageId: bigint): void => {
            if (storeValue.get(key)?.messageIds.has(messageId)) {
                store.update((state) => {
                    const newState = state.get(key);
                    if (newState !== undefined && newState.messageIds.has(messageId)) {
                        newState.messageIds.set(messageId, true);
                    }
                    return state;
                });
            }
        },
        pendingAcceptance: (key: MessageContext, messageId: bigint): boolean => {
            return storeValue.get(key)?.messageIds.get(messageId) === false;
        },
        delete: (key: MessageContext, messageId: bigint): boolean => {
            if (storeValue.get(key)?.messageIds.has(messageId)) {
                store.update((state) => {
                    const s = state.get(key);
                    if (s !== undefined) {
                        const newState = filterMessages(s, (m) => m.event.messageId !== messageId);
                        if (newState.messageIds.size === 0) {
                            state.delete(key);
                        } else {
                            state.set(key, newState);
                        }
                    }
                    return state;
                });
                return true;
            }
            return false;
        },
        clear: (initialVal: UnconfirmedMessages = {} as UnconfirmedMessages): void =>
            store.set(initialVal),
    };
}

function revokeObjectUrls(message: EventWrapper<Message>): void {
    if ("blobUrl" in message.event.content && message.event.content.blobUrl !== undefined) {
        URL.revokeObjectURL(message.event.content.blobUrl);
    }
}

export const unconfirmedReadByThem = createUnconfirmedReadByThemStore();

export const unconfirmed = createUnconfirmedStore();
