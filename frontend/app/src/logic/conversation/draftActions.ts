import {
    localUpdates,
    messageReplyContext,
    type ChatIdentifier,
    type EventWrapper,
    type Message,
    type UserLookup,
} from "@client";

// What replying to a message and editing one do to the chat's draft, which the composer shows (a
// message's menu, its swipes, a double click), in every tree.

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
