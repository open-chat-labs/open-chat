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
} from "@shared";
import { writable, type Subscriber } from "../utils/stores";
import { notEq } from "./utils";

/** What the user was writing before starting an edit, put back once the edit is over. */
export type DraftBeforeEdit = {
    textContent?: string;
    attachment?: AttachmentContent;
    replyingTo?: EnhancedReplyContext;
};

export class DraftMessage {
    textContent?: string;
    attachment?: AttachmentContent;
    editingEvent?: EventWrapper<Message>;
    replyingTo?: EnhancedReplyContext;
    // while editing: the draft as it was when the edit started
    beforeEdit?: DraftBeforeEdit;
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
        /**
         * Ends an edit, saved or cancelled: the draft goes back to what the user was writing when
         * it started (none if nothing was).
         */
        endEditing(key: MessageContext) {
            store.update((map) => {
                const before = map.get(key)?.beforeEdit;
                if (
                    before === undefined ||
                    (before.textContent === undefined &&
                        before.attachment === undefined &&
                        before.replyingTo === undefined)
                ) {
                    map.delete(key);
                } else {
                    map.set(key, { ...before });
                }
                return map;
            });
        },
        /**
         * Starts editing a message: the draft holds its text, attachment and reply, and keeps
         * what the user was writing (from before the first edit, if one is already going) for
         * `endEditing` to put back.
         */
        setEditing(
            key: MessageContext,
            editingEvent: EventWrapper<Message>,
            userLookup: UserLookup,
        ) {
            updateDraft(key, (d) => {
                return {
                    ...d,
                    beforeEdit:
                        d.editingEvent !== undefined
                            ? d.beforeEdit
                            : {
                                  textContent: d.textContent,
                                  attachment: d.attachment,
                                  replyingTo: d.replyingTo,
                              },
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
