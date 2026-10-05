import {
    chatIdentifiersEqual,
    getContentAsText,
    isAttachmentContent,
    MessageContextMap,
    type AttachmentContent,
    type DirectChatIdentifier,
    type EnhancedReplyContext,
    type EventWrapper,
    type Message,
    type MessageContext,
    type UserLookup,
} from "@shared";
import { writable, type Subscriber } from "../utils/stores";
import { notEq } from "./utils";

export class DraftMessage {
    textContent?: string;
    attachment?: AttachmentContent;
    editingEvent?: EventWrapper<Message>;
    replyingTo?: EnhancedReplyContext;
}

// A draft transfer to the other user in a chat moved onto their new id, addressed to the new id
function movedAttachment(
    attachment: AttachmentContent | undefined,
    from: DirectChatIdentifier,
    to: DirectChatIdentifier,
): AttachmentContent | undefined {
    if (
        attachment?.kind !== "crypto_content" ||
        attachment.transfer.kind !== "pending" ||
        attachment.transfer.recipient !== from.userId
    ) {
        return attachment;
    }
    return { ...attachment, transfer: { ...attachment.transfer, recipient: to.userId } };
}

// A draft reply to a message in a chat moved onto the other user's new id, pointed at the new id
function movedReplyingTo(
    replyingTo: EnhancedReplyContext | undefined,
    from: DirectChatIdentifier,
    to: DirectChatIdentifier,
): EnhancedReplyContext | undefined {
    if (replyingTo === undefined || !chatIdentifiersEqual(replyingTo.sourceContext.chatId, from)) {
        return replyingTo;
    }
    return { ...replyingTo, sourceContext: { ...replyingTo.sourceContext, chatId: to } };
}

export function createDraftMessagesStore() {
    const store = writable<MessageContextMap<DraftMessage>>(
        new MessageContextMap(),
        undefined,
        notEq,
    );

    function updateDraft(key: MessageContext, fn: (d: DraftMessage) => DraftMessage) {
        store.update((s) => {
            let draft = s.get(key);
            if (draft === undefined) {
                draft = new DraftMessage();
            }
            s.set(key, fn(draft));
            return s;
        });
    }

    return {
        subscribe: (sub: Subscriber<MessageContextMap<DraftMessage>>, invalidate?: () => void) =>
            store.subscribe(sub, invalidate),
        get value() {
            return store.value;
        },
        setTextContent(key: MessageContext, textContent?: string) {
            updateDraft(key, (d) => ({ ...d, textContent }));
        },
        setAttachment(key: MessageContext, attachment?: AttachmentContent) {
            updateDraft(key, (d) => ({ ...d, attachment }));
        },
        setReplyingTo(key: MessageContext, replyingTo?: EnhancedReplyContext) {
            updateDraft(key, (d) => ({ ...d, replyingTo }));
        },
        delete(key: MessageContext) {
            store.update((map) => {
                map.delete(key);
                return map;
            });
        },
        // Moves the draft for `from` onto `to`, for a direct chat moved onto the other user's new id
        // after they were migrated to a MultiUser canister. The chat keeps its messages, so a draft
        // replying to or editing one of them still applies, once a reply to one of them is pointed
        // at the new id. So is a draft transfer to them, which the canister would otherwise refuse
        // as being to someone other than the user it's now sent to. A draft already held for `to`
        // is kept.
        moveChat(from: DirectChatIdentifier, to: DirectChatIdentifier) {
            const draft = store.value.get({ chatId: from });
            if (draft === undefined) return;

            store.update((map) => {
                map.delete({ chatId: from });
                if (!map.has({ chatId: to })) {
                    map.set(
                        { chatId: to },
                        {
                            ...draft,
                            attachment: movedAttachment(draft.attachment, from, to),
                            replyingTo: movedReplyingTo(draft.replyingTo, from, to),
                        },
                    );
                }
                return map;
            });
        },
        setEditing(
            key: MessageContext,
            editingEvent: EventWrapper<Message>,
            userLookup: UserLookup,
        ) {
            updateDraft(key, (d) => {
                return {
                    ...d,
                    textContent: getContentAsText(editingEvent.event.content),
                    editingEvent: editingEvent,
                    attachment: isAttachmentContent(editingEvent.event.content)
                        ? editingEvent.event.content
                        : undefined,
                    replyingTo:
                        editingEvent.event.repliesTo &&
                        editingEvent.event.repliesTo.kind === "rehydrated_reply_context"
                            ? {
                                  ...editingEvent.event.repliesTo,
                                  content: editingEvent.event.content,
                                  sender: userLookup.get(editingEvent.event.sender),
                              }
                            : undefined,
                };
            });
        },
    };
}
