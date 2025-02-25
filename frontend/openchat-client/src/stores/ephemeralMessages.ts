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
    };
}

export const ephemeralMessages = createEphemeralStore();
