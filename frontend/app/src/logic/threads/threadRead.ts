import type { ChatEvent, ChatSummary, EventWrapper, ThreadSyncDetails } from "@client";

// How many of a followed thread's replies are unread, and when a thread's preview (a card in the
// list of threads) marks the thread read, as both old trees' cards decide it.

/** The chat's sync details for a thread it follows (its latest message, how far it's read). */
export function followedThread(
    chat: ChatSummary | undefined,
    threadRootMessageIndex: number,
): ThreadSyncDetails | undefined {
    if (chat === undefined || chat.kind === "direct_chat") return undefined;
    return chat.membership.latestThreads.find(
        (t) => t.threadRootMessageIndex === threadRootMessageIndex,
    );
}

/**
 * A thread's unread replies, up to its latest message as the chat's sync last said
 * (`unreadThreadMessageCount`, which follows `messagesRead`); none for a thread the chat doesn't
 * list as followed.
 */
export function threadUnreadCount(
    chat: ChatSummary | undefined,
    threadRootMessageIndex: number,
    unread: (latestMessageIndex: number) => number,
): number {
    const thread = followedThread(chat, threadRootMessageIndex);
    return thread === undefined ? 0 : unread(thread.latestMessageIndex);
}

/** The last message's index among a thread's latest replies, if any of them is a message. */
export function lastMessageIndex(events: EventWrapper<ChatEvent>[]): number | undefined {
    for (let i = events.length - 1; i >= 0; i--) {
        const evt = events[i].event;
        if (evt.kind === "message") return evt.messageIndex;
    }
    return undefined;
}

/**
 * Up to which reply a thread's preview marks the thread read once its latest replies are on
 * screen: the last of them, but only when every unread reply is among them (so the reader has
 * seen them all). Undefined when there's nothing unread, or more unread than the preview shows.
 */
export function threadReadOnSight(
    unreadCount: number,
    latestReplies: EventWrapper<ChatEvent>[],
): number | undefined {
    if (unreadCount <= 0 || unreadCount > latestReplies.length) return undefined;
    return lastMessageIndex(latestReplies);
}
