import {
    type EventWrapper,
    type Message,
    type MessageContext,
    MessageContextMap,
} from "openchat-shared";
import { createMessageContextSpecificObjectStore } from "./dataByMessageContextFactory";

type FailedMessageState = Record<number, EventWrapper<Message>>;
export type FailedMessages = MessageContextMap<FailedMessageState>;

function createFailedMessagesStore() {
    const store = createMessageContextSpecificObjectStore(() => ({}) as FailedMessageState);

    return {
        subscribe: store.subscribe,
        getMessages: (key: MessageContext): EventWrapper<Message>[] => {
            const chatState = store.get(key);
            return chatState ? Object.values(chatState) : [];
        },
        add: (key: MessageContext, message: EventWrapper<Message>): void => {
            store.update(key, (chatState) => ({
                ...chatState,
                [Number(message.event.messageId)]: message,
            }));
        },
        contains: (key: MessageContext, messageId: bigint): boolean => {
            const chatState = store.get(key);
            return chatState ? chatState[Number(messageId)] !== undefined : false;
        },
        delete: (key: MessageContext, messageId: bigint): boolean => {
            const chatState = store.get(key);
            if (chatState && chatState[Number(messageId)]) {
                delete chatState[Number(messageId)];
                store.set(key, chatState);
                return true;
            }
            return false;
        },
        initialise(data: FailedMessages) {
            store.clear(data);
        },
    };
}

export const failedMessagesStore = createFailedMessagesStore();
