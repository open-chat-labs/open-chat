import {
    getContentAsText,
    isAttachmentContent,
    type AttachmentContent,
    type EnhancedReplyContext,
    type EventWrapper,
    type Message,
    type MessageContext,
    type MessageContextMap,
} from "openchat-shared";
import { userStore } from "../state/users/users.svelte";
import { createMessageContextSpecificObjectStore } from "./dataByMessageContextFactory";

export type DraftMessages = MessageContextMap<DraftMessage>;

export type DraftMessage = {
    textContent?: string | undefined;
    attachment?: AttachmentContent | undefined;
    editingEvent?: EventWrapper<Message> | undefined;
    replyingTo?: EnhancedReplyContext | undefined;
};

function createDraftMessages() {
    const store = createMessageContextSpecificObjectStore(() => ({}) as DraftMessage);

    return {
        ...store,
        setTextContent: (context: MessageContext, textContent: string | undefined): void =>
            store.update(context, (current) => ({ ...current, textContent })),
        setAttachment: (context: MessageContext, attachment: AttachmentContent | undefined): void =>
            store.update(context, (current) => ({ ...current, attachment })),
        setEditing: (context: MessageContext, editingEvent: EventWrapper<Message>): void => {
            const users = userStore.allUsers;
            store.update(context, (_) => ({
                textContent: getContentAsText(editingEvent.event.content),
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
                              sender: users.get(editingEvent.event.sender),
                          }
                        : undefined,
            }));
        },
        setReplyingTo: (
            context: MessageContext,
            replyingTo: EnhancedReplyContext | undefined,
        ): void => store.update(context, (current) => ({ ...current, replyingTo })),
    };
}

export const draftMessagesStore = createDraftMessages();
