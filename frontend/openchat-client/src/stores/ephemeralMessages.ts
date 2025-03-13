import { writable } from "svelte/store";
import {
    type EventWrapper,
    type Message,
    type MessageContext,
    MessageContextMap,
} from "openchat-shared";

export type EphemeralState = Map<bigint, EventWrapper<Message>>;

export type EphemeralMessages = MessageContextMap<EphemeralState>;

function createEphemeralStore() {
    const store = writable<EphemeralMessages>(new MessageContextMap<EphemeralState>());
    let storeValue: EphemeralMessages = new MessageContextMap<EphemeralState>();
    store.subscribe((v) => (storeValue = v));

    return {
        subscribe: store.subscribe,
        add: (key: MessageContext, message: EventWrapper<Message>): void => {
            store.update((state) => {
                const s = state.get(key) ?? new Map();
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
    };
}

export const ephemeralMessages = createEphemeralStore();
