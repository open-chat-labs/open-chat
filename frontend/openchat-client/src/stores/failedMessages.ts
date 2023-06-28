import { writable } from "svelte/store";
import { EventWrapper, Message, MessageContext, MessageContextMap } from "openchat-shared";

type FailedMessageState = Record<number, EventWrapper<Message>>;
export type FailedMessages = MessageContextMap<FailedMessageState>;

function createFailedMessagesStore() {
    const store = writable<FailedMessages>(new MessageContextMap<FailedMessageState>());
    let storeValue: FailedMessages = new MessageContextMap<FailedMessageState>();
    store.subscribe((v) => (storeValue = v));

    return {
        subscribe: store.subscribe,
        getMessages: (key: MessageContext): EventWrapper<Message>[] => {
            const chatState = storeValue.get(key);
            return chatState ? Object.values(chatState) : [];
        },
        add: (key: MessageContext, message: EventWrapper<Message>): void => {
            store.update((state) => {
                const chatState = state.get(key) ?? {};
                state.set(key, {
                    ...chatState,
                    [Number(message.event.messageId)]: message,
                });
                return state;
            });
        },
        contains: (key: MessageContext, messageId: bigint): boolean => {
            const chatState = storeValue.get(key);
            return chatState ? chatState[Number(messageId)] !== undefined : false;
        },
        delete: (key: MessageContext, messageId: bigint): boolean => {
            const chatState = storeValue.get(key);
            if (chatState && chatState[Number(messageId)]) {
                delete chatState[Number(messageId)];
                store.update((state) => {
                    state.set(key, { ...chatState });
                    return state;
                });
                return true;
            }
            return false;
        },
        initialise(data: FailedMessages) {
            store.set(data);
        },
    };
}

export const failedMessagesStore = createFailedMessagesStore();
