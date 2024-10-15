import {
    type EventWrapper,
    type Message,
    type MessageContext,
    MessageContextMap,
} from "openchat-shared";
import { createMessageContextSpecificObjectStore } from "./dataByMessageContextFactory";

type FailedMessageState = Record<string, EventWrapper<Message>>;
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
                [message.event.messageId.toString()]: message,
            }));
        },
        contains: (key: MessageContext, messageId: bigint): boolean => {
            const chatState = store.get(key);
            return chatState ? chatState[messageId.toString()] !== undefined : false;
        },
        delete: (key: MessageContext, messageId: bigint): boolean => {
            const chatState = store.get(key);
            const messageIdString = messageId.toString();
            if (chatState && chatState[messageIdString]) {
                delete chatState[messageIdString];
                store.set(key, chatState);
                return true;
            }
            return false;
        },
        initialise: (data: FailedMessages) => {
            store.clear(data);
        },
        has: store.has
    };
}

export const failedMessagesStore = createFailedMessagesStore();
