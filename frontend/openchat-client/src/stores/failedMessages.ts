import { writable } from "svelte/store";
import type { EventWrapper, Message } from "openchat-shared";

export type FailedMessages = Record<string, Record<number, EventWrapper<Message>>>;

function createFailedMessagesStore() {
    const store = writable<FailedMessages>({} as FailedMessages);
    let storeValue: FailedMessages = {};
    store.subscribe((v) => (storeValue = v));

    return {
        subscribe: store.subscribe,
        getMessages: (key: string): EventWrapper<Message>[] => {
            const chatState = storeValue[key];
            return chatState ? Object.values(chatState) : [];
        },
        add: (key: string, message: EventWrapper<Message>): void => {
            store.update((state) => {
                const chatState = state[key] ?? {};
                return {
                    ...state,
                    [key]: {
                        ...chatState,
                        [Number(message.event.messageId)]: message,
                    },
                };
            });
        },
        contains: (key: string, messageId: bigint): boolean => {
            const chatState = storeValue[key];
            return chatState ? chatState[Number(messageId)] !== undefined : false;
        },
        delete: (key: string, messageId: bigint): boolean => {
            const chatState = storeValue[key];
            if (chatState && chatState[Number(messageId)]) {
                delete chatState[Number(messageId)];
                store.update((state) => ({
                    ...state,
                    [key]: {
                        ...chatState,
                    },
                }));
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
