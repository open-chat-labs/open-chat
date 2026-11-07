import type { ChatEvent, ChatIdentifier, EventWrapper, Message, MessageContext } from "@client";

// A thread's list of events: its replies, headed by the root message once they're loaded back to
// the first one (the old trees), or its replies alone (the web, whose thread panel shows the root
// as a card above them), and which of them count as read.

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
 * The events the web's thread list shows: the replies loaded (`threadEventsStore`) alone, the root
 * left out wherever it is, as the thread panel's card above the list shows it (4c invariant 3).
 */
export function threadReplyEvents(
    root: EventWrapper<Message> | undefined,
    replies: EventWrapper<ChatEvent>[],
): EventWrapper<ChatEvent>[] {
    if (root === undefined) return replies;
    const rootId = root.event.messageId;
    const isRoot = (evt: EventWrapper<ChatEvent>) =>
        evt.event.kind === "message" && evt.event.messageId === rootId;
    return replies.some(isRoot) ? replies.filter((evt) => !isRoot(evt)) : replies;
}

/**
 * Whether the reader follows the thread: as its root's thread summary says, which a follow or an
 * unfollow updates at once (`followThread`), else as the chat's followed threads say
 * (`threadsFollowedByMeStore`, which only changes with the next sync) for a thread with no summary
 * yet.
 */
export function followsThread(
    root: Pick<Message, "messageIndex" | "thread">,
    followedRoots: ReadonlySet<number> | undefined,
): boolean {
    return root.thread?.followedByMe ?? followedRoots?.has(root.messageIndex) ?? false;
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

/**
 * The thread a message in a thread's list is in: none for its root, which is the chat's message
 * (it heads the list, but lives in the chat), else the thread's root index. Outside a thread
 * (`root` undefined), none.
 */
export function threadRootIndexFor(
    root: Pick<Message, "messageId" | "messageIndex"> | undefined,
    message: Pick<Message, "messageId">,
): number | undefined {
    return root === undefined || root.messageId === message.messageId
        ? undefined
        : root.messageIndex;
}

/**
 * Where a row's message is, which every action on it goes to (reactions, the menu's actions,
 * delete, a poll vote, a swap, removing a link preview, reporting, a reminder, copying its link):
 * a thread's reply is in the thread, its root in the chat (threadRootIndexFor).
 */
export function rowMessageContext(
    chatId: ChatIdentifier,
    root: Pick<Message, "messageId" | "messageIndex"> | undefined,
    message: Pick<Message, "messageId">,
): MessageContext {
    const threadRootMessageIndex = threadRootIndexFor(root, message);
    return threadRootMessageIndex === undefined
        ? { chatId }
        : { chatId, threadRootMessageIndex };
}
