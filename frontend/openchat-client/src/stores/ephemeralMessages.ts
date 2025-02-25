import { writable } from "svelte/store";
import {
    type EventWrapper,
    type Message,
    type MessageContext,
    MessageContextMap,
} from "openchat-shared";

export type EphemeralState = Map<bigint, EventWrapper<Message>>;

export type EphemeralMessages = MessageContextMap<EphemeralState>;

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
function createEphemeralStore() {
    const store = writable<EphemeralMessages>(new MessageContextMap<EphemeralState>());
    let storeValue: EphemeralMessages = new MessageContextMap<EphemeralState>();
    store.subscribe((v) => (storeValue = v));

    function emptyState(): EphemeralState {
        return new Map();
    }

    return {
        subscribe: store.subscribe,
        getMessages: (key: MessageContext): EventWrapper<Message>[] => {
            const vals = storeValue.get(key)?.values();
            return vals ? [...vals] : [];
        },
        add: (key: MessageContext, message: EventWrapper<Message>): void => {
            store.update((state) => {
                const s = state.get(key) ?? emptyState();
                if (!s.has(message.event.messageId)) {
                    s.set(message.event.messageId, message);
                    state.set(key, s);
                }
                return state;
            });
        },
        contains: (key: MessageContext, messageId: bigint): boolean => {
            return storeValue.get(key)?.has(messageId) ?? false;
        },
        delete: (key: MessageContext, messageId: bigint): boolean => {
            const msg = storeValue.get(key)?.get(messageId);
            if (msg !== undefined) {
                store.update((state) => {
                    const s = state.get(key);
                    if (s !== undefined) {
                        s.delete(messageId);
                        revokeObjectUrls(msg);
                        if (s.size === 0) {
                            state.delete(key);
                        } else {
                            state.set(key, s);
                        }
                    }
                    return state;
                });
                return true;
            }
            return false;
        },
        clear: (initialVal: EphemeralMessages = {} as EphemeralMessages): void =>
            store.set(initialVal),
    };
}

function revokeObjectUrls(message: EventWrapper<Message>): void {
    if ("blobUrl" in message.event.content && message.event.content.blobUrl !== undefined) {
        URL.revokeObjectURL(message.event.content.blobUrl);
    }
}

export const ephemeralMessages = createEphemeralStore();
