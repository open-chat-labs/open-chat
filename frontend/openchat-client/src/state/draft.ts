import {
    chatIdentifiersEqual,
    getContentAsText,
    isAttachmentContent,
    MessageContextMap,
    type AttachmentContent,
    type ChatIdentifier,
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
        // Moves the drafts for `from`, in the chat and in each of its threads, onto `to`, for a
        // direct chat moved onto the other user's new id after they were migrated to a MultiUser
        // canister. The chat keeps its messages, so a draft replying to or editing one of them
        // still applies, once a reply to one of them is pointed at the new id. A draft already held
        // for `to` is kept.
        moveChat(from: ChatIdentifier, to: ChatIdentifier) {
            const moving = [...store.value].filter(([key]) =>
                chatIdentifiersEqual(key.chatId, from),
            );
            if (moving.length === 0) return;

            store.update((map) => {
                for (const [key, draft] of moving) {
                    map.delete(key);
                    const movedKey = { ...key, chatId: to };
                    if (map.has(movedKey)) continue;
                    const replyingTo =
                        draft.replyingTo !== undefined &&
                        chatIdentifiersEqual(draft.replyingTo.sourceContext.chatId, from)
                            ? {
                                  ...draft.replyingTo,
                                  sourceContext: { ...draft.replyingTo.sourceContext, chatId: to },
                              }
                            : draft.replyingTo;
                    map.set(movedKey, { ...draft, replyingTo });
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
