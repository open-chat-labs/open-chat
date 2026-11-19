import {
    localUpdates,
    messageContextsEqual,
    messageReplyContext,
    type DirectChatIdentifier,
    type EnhancedReplyContext,
    type EventWrapper,
    type GiphyContent,
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

/**
 * Sets the draft where the message is (`context`: the chat, or the thread in it) to reply to the
 * message. An edit going on there ends: its text is dropped and the draft goes back to what was
 * being written before it, now replying to this message. Another chat's or thread's edit stays.
 */
export function replyToMessage(
    context: MessageContext,
    evt: EventWrapper<Message>,
    users: UserLookup,
): void {
    localUpdates.draftMessages.replyTo(
        context,
        messageReplyContext(evt, users.get(evt.event.sender), context),
    );
}

/**
 * Starts editing the message in the draft where it is (`context`: the chat, or the thread in it),
 * with what was written before kept.
 */
export function editMessage(
    context: MessageContext,
    evt: EventWrapper<Message>,
    users: UserLookup,
): void {
    localUpdates.draftMessages.setEditing(context, evt, users);
}

/**
 * The sender's DM once the client's `replyPrivately` has set its reply: an edit going on there
 * ends too (its text dropped), the reply showing with nothing written, as it does when nothing was
 * being edited. The client's call, which the old mobile tree makes too, leaves the edit in place
 * with its text blanked and the reply behind it.
 */
export function privateReplyEndsEdit(
    dm: DirectChatIdentifier,
    replyingTo: EnhancedReplyContext,
): void {
    const context = { chatId: dm };
    if (localUpdates.draftMessages.value.get(context)?.editingEvent === undefined) return;
    localUpdates.draftMessages.replyTo(context, replyingTo);
    localUpdates.draftMessages.setTextContent(context, "");
}

/**
 * A GIF picked in the web composer's picker: the draft's attachment, in place of whatever was
 * attached (as a file picked is), to go out with Send, the text its caption and as a reply to the
 * draft's reply, like a photo. Not sent as it's picked (the user's decision, 2026-11-19, against
 * web spec 06's "Picking sends the GIF"; the old desktop picker took a caption too). The native
 * panel sends as it's tapped, by design.
 */
export function attachGif(context: MessageContext, content: GiphyContent): void {
    localUpdates.draftMessages.setAttachment(context, content);
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
