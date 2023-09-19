/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { get, writable } from "svelte/store";
import {
    isAttachmentContent,
    type AttachmentContent,
    type EnhancedReplyContext,
    type EventWrapper,
    type Message,
} from "openchat-shared";
import { userStore } from "./user";

export type DraftMessagesByThread = Record<number, DraftMessage>;

export type DraftMessage = {
    textContent?: string | undefined;
    attachment?: AttachmentContent | undefined;
    editingEvent?: EventWrapper<Message> | undefined;
    replyingTo?: EnhancedReplyContext | undefined;
};

export function createDraftMessages() {
    const store = writable<DraftMessagesByThread>({} as DraftMessagesByThread);

    function set(id: number, draftMessage: DraftMessage): void {
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
        get: (id: number): DraftMessage => {
            return get(store)[id] ?? {};
        },
        setTextContent: (id: number, textContent: string | undefined): void =>
            set(id, { textContent }),
        setAttachment: (id: number, attachment: AttachmentContent | undefined): void =>
            set(id, { attachment }),
        setEditing: (id: number, editingEvent: EventWrapper<Message>): void => {
            const users = get(userStore);
            set(id, {
                editingEvent,
                attachment: isAttachmentContent(editingEvent.event.content)
                    ? editingEvent.event.content
                    : undefined,
                replyingTo:
                    editingEvent.event.repliesTo &&
                    editingEvent.event.repliesTo.kind === "rehydrated_reply_context"
                        ? {
                              ...editingEvent.event.repliesTo,
                              content: editingEvent.event.content,
                              sender: users[editingEvent.event.sender],
                          }
                        : undefined,
            });
        },
        setReplyingTo: (id: number, replyingTo: EnhancedReplyContext | undefined): void =>
            set(id, { replyingTo }),
        delete: (id: number): void =>
            store.update((draftMessages) => {
                delete draftMessages[id];
                return draftMessages;
            }),
    };
}
