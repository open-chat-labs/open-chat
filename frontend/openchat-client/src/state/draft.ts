import {
    getContentAsText,
    isAttachmentContent,
    MessageContextMap,
    type AttachmentContent,
    type EnhancedReplyContext,
    type EventWrapper,
    type Message,
    type MessageContext,
    type UserLookup,
} from "openchat-shared";
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
        subscribe: (sub: Subscriber<MessageContextMap<DraftMessage>>) => store.subscribe(sub),
        value: store.value,
        setTextContent(key: MessageContext, textContent?: string) {
            updateDraft(key, (d) => ({ ...d, textContent }));
        },
        setAttachment(key: MessageContext, attachment?: AttachmentContent) {
            updateDraft(key, (d) => ({ ...d, attachment }));
        },
        setReplyingTo(key: MessageContext, replyingTo?: EnhancedReplyContext) {
            updateDraft(key, (d) => ({ ...d, replyingTo }));
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
