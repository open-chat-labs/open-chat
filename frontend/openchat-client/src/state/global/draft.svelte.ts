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
import { ReactiveMessageContextMap } from "../map";

export class DraftMessage {
    textContent = $state<string>();
    attachment = $state<AttachmentContent>();
    editingEvent = $state<EventWrapper<Message>>();
    replyingTo = $state<EnhancedReplyContext>();
}

export class DraftMessages {
    #draftMessages = new ReactiveMessageContextMap<DraftMessage>();

    #getOrCreate(key: MessageContext) {
        let state = this.#draftMessages.get(key);
        if (state === undefined) {
            state = new DraftMessage();
            this.#draftMessages.set(key, state);
        }
        return state;
    }

    get(key: MessageContext) {
        return this.#draftMessages.get(key);
    }

    delete(key: MessageContext) {
        this.#draftMessages.delete(key);
    }

    setTextContent(key: MessageContext, textContent?: string) {
        this.#getOrCreate(key).textContent = textContent;
    }

    setAttachment(key: MessageContext, attachment?: AttachmentContent) {
        this.#getOrCreate(key).attachment = attachment;
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
    }

    setReplyingTo(key: MessageContext, replyingTo?: EnhancedReplyContext) {
        this.#getOrCreate(key).replyingTo = replyingTo;
    }
}
