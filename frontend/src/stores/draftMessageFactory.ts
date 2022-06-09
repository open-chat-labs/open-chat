/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { get, writable } from "svelte/store";
import type {
    EnhancedReplyContext,
    EventWrapper,
    Message,
    MessageContent,
} from "../domain/chat/chat";

type KeyType = string | number | symbol;

type DraftMessagesByKey<T extends KeyType> = Record<T, DraftMessage>;

export type DraftMessage = {
    textContent?: string | undefined;
    attachment?: MessageContent | undefined;
    editingEvent?: EventWrapper<Message> | undefined;
    replyingTo?: EnhancedReplyContext | undefined;
};

/**
 * There are two scenarios. The draft message can either be at the chat level or for a specific thread
 */
export function createDraftMessages<T extends KeyType>() {
    const store = writable<DraftMessagesByKey<T>>({} as DraftMessagesByKey<T>);

    function set(id: T, draftMessage: DraftMessage): void {
        store.update((draftMessages) => {
            const current = draftMessages[id];
            return {
                ...draftMessages,
                [id]: {
                    ...current,
                    ...draftMessage,
                },
            };
        });
    }

    return {
        subscribe: store.subscribe,
        get: (id: T): DraftMessage => {
            return get(store)[id] ?? {};
        },
        setTextContent: (id: T, textContent: string | undefined): void => set(id, { textContent }),
        setAttachment: (id: T, attachment: MessageContent | undefined): void =>
            set(id, { attachment }),
        setEditingEvent: (id: T, editingEvent: EventWrapper<Message> | undefined): void =>
            set(id, { editingEvent }),
        setReplyingTo: (id: T, replyingTo: EnhancedReplyContext | undefined): void =>
            set(id, { replyingTo }),
        delete: (id: T): void =>
            store.update((draftMessages) => {
                delete draftMessages[id];
                return draftMessages;
            }),
    };
}
