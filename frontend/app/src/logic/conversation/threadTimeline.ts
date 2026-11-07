import type { ChatEvent, EventWrapper, Message } from "@client";

// A thread's list of events, as every tree shows it: its replies, headed by the root message once
// they're loaded back to the first one, and which of them count as read.

/**
 * The events a thread's list shows: the replies loaded (`threadEventsStore`), with the root
 * message at their head only once they're loaded back to the first reply (index 0), so a long
 * thread pages back to its root, and only once. The root can be missing for a moment (the chat's
 * event window replaced while the thread is open): then only the replies.
 */
export function threadTimelineEvents(
    root: EventWrapper<Message> | undefined,
    replies: EventWrapper<ChatEvent>[],
): EventWrapper<ChatEvent>[] {
    if (root === undefined) return replies;
    const first = replies[0];
    const atRoot = first === undefined || first.index === 0;
    if (!atRoot) return replies;
    if (first?.event.kind === "message" && first.event.messageId === root.event.messageId) {
        return replies;
    }
    return [root, ...replies];
}

/**
 * Whether an event in a thread's list counts as read: the root always does (it's the chat's
 * message, not the thread's), and so does every reply in a thread the reader doesn't follow,
 * which never shows as unread; otherwise it's whether the reader has read it (`readByMe`).
 */
export function threadEventReadByMe(
    evt: EventWrapper<ChatEvent>,
    rootMessageId: bigint | undefined,
    following: boolean,
    readByMe: boolean,
): boolean {
    if (evt.event.kind === "message" && evt.event.messageId === rootMessageId) return true;
    return !following || readByMe;
}
