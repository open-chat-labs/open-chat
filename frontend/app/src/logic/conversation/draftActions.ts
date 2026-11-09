import {
    localUpdates,
    messageContextsEqual,
    messageReplyContext,
    type ChatIdentifier,
    type EnhancedReplyContext,
    type EventWrapper,
    type Message,
    type MessageContext,
    type OpenChat,
    type UserLookup,
} from "@client";
import { detectMarkdown } from "@src/utils/detectMarkdown";

// What replying to a message and editing one do to the chat's draft, which the composer shows (a
// message's menu, its swipes, a double click), and what the composer does with them, in every tree.

/** The draft's reply or edit, as the composer reads it. */
type Composing = {
    editingEvent?: EventWrapper<Message>;
    replyingTo?: EnhancedReplyContext;
};

/** Sets the chat's draft to reply to the message. */
export function replyToMessage(
    chatId: ChatIdentifier,
    evt: EventWrapper<Message>,
    users: UserLookup,
): void {
    const context = { chatId };
    localUpdates.draftMessages.setReplyingTo(
        context,
        messageReplyContext(evt, users.get(evt.event.sender), context),
    );
}

/** Starts editing the message: the chat's draft holds it, with what was written before kept. */
export function editMessage(
    chatId: ChatIdentifier,
    evt: EventWrapper<Message>,
    users: UserLookup,
): void {
    localUpdates.draftMessages.setEditing({ chatId }, evt, users);
}

/**
 * The composer's × on its reply or edit: cancelling an edit puts back what was being written
 * before it; a reply just goes.
 */
export function cancelComposing(context: MessageContext, draft: Composing | undefined): void {
    if (draft?.editingEvent !== undefined) {
        localUpdates.draftMessages.endEditing(context);
    } else {
        localUpdates.draftMessages.setReplyingTo(context, undefined);
    }
}

/**
 * Saves the edit the draft holds with the text written (block markdown detected): the client puts
 * the draft back as the edit goes out, and undoes the edit if it fails. False when it failed;
 * nothing being edited, there's nothing to fail.
 */
export async function submitEdit(
    client: Pick<OpenChat, "editMessage">,
    context: MessageContext,
    draft: Composing | undefined,
    text: string,
): Promise<boolean> {
    const editing = draft?.editingEvent;
    if (editing === undefined) return true;
    return client.editMessage(context, text, detectMarkdown(text), editing);
}

/**
 * The message the composer is replying to or editing, if it's in this chat or thread (`context`),
 * to go to from the composer's strip: a private reply quotes another chat's.
 */
export function composingMessageIndex(
    draft: Composing | undefined,
    context: MessageContext,
): number | undefined {
    if (draft?.editingEvent !== undefined) return draft.editingEvent.event.messageIndex;
    const reply = draft?.replyingTo;
    return reply !== undefined && messageContextsEqual(reply.sourceContext, context)
        ? reply.messageIndex
        : undefined;
}
