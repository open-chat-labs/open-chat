import {
    getContentAsText,
    isAttachmentContent,
    type AttachmentContent,
    type EnhancedReplyContext,
    type EventWrapper,
    type Message,
    type MessageContext,
    type UserLookup,
} from "openchat-shared";
import { MessageContextMapStore } from "./map";

export class DraftMessage {
    textContent?: string;
    attachment?: AttachmentContent;
    editingEvent?: EventWrapper<Message>;
    replyingTo?: EnhancedReplyContext;
}

export class DraftMessages extends MessageContextMapStore<DraftMessage> {
    #getOrCreate(key: MessageContext) {
        let state = this.get(key);
        if (state === undefined) {
            state = new DraftMessage();
            this.set(key, state);
        }
        return state;
    }

    setTextContent(key: MessageContext, textContent?: string) {
        this.#getOrCreate(key).textContent = textContent;
        this.publish();
    }

    setAttachment(key: MessageContext, attachment?: AttachmentContent) {
        this.#getOrCreate(key).attachment = attachment;
        this.publish();
    }

    setEditing(key: MessageContext, editingEvent: EventWrapper<Message>, userLookup: UserLookup) {
        const state = this.#getOrCreate(key);
        state.textContent = getContentAsText(editingEvent.event.content);
        state.editingEvent = editingEvent;
        state.attachment = isAttachmentContent(editingEvent.event.content)
            ? editingEvent.event.content
            : undefined;
        state.replyingTo =
            editingEvent.event.repliesTo &&
            editingEvent.event.repliesTo.kind === "rehydrated_reply_context"
                ? {
                      ...editingEvent.event.repliesTo,
                      content: editingEvent.event.content,
                      sender: userLookup.get(editingEvent.event.sender),
                  }
                : undefined;
        this.publish();
    }

    setReplyingTo(key: MessageContext, replyingTo?: EnhancedReplyContext) {
        this.#getOrCreate(key).replyingTo = replyingTo;
        this.publish();
    }
}
