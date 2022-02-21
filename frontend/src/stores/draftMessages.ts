import { get, writable } from "svelte/store";
import type {
    EnhancedReplyContext,
    EventWrapper,
    Message,
    MessageContent,
} from "../domain/chat/chat";

type DraftMessagesByChat = Record<string, DraftMessage>;

export type DraftMessage = {
    textContent?: string | undefined;
    attachment?: MessageContent | undefined;
    editingEvent?: EventWrapper<Message> | undefined;
    replyingTo?: EnhancedReplyContext | undefined;
};

const store = writable<DraftMessagesByChat>({});

export const draftMessages = {
    subscribe: store.subscribe,
    get: (chatId: string): DraftMessage => {
        return get(store)[chatId] ?? {};
    },
    setTextContent: (chatId: string, textContent: string | undefined): void =>
        set(chatId, { textContent }),
    setAttachment: (chatId: string, attachment: MessageContent | undefined): void =>
        set(chatId, { attachment }),
    setEditingEvent: (chatId: string, editingEvent: EventWrapper<Message> | undefined): void =>
        set(chatId, { editingEvent }),
    setReplyingTo: (chatId: string, replyingTo: EnhancedReplyContext | undefined): void =>
        set(chatId, { replyingTo }),
    delete: (chatId: string): void =>
        store.update((draftMessages) => {
            delete draftMessages[chatId];
            return draftMessages;
        }),
};

function set(chatId: string, draftMessage: DraftMessage): void {
    store.update((draftMessages) => {
        const current = draftMessages[chatId];
        return {
            ...draftMessages,
            [chatId]: {
                ...current,
                ...draftMessage,
            },
        };
    });
}
