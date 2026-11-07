import type { ChatEvent, EventWrapper } from "@client";

// When a thread's preview (a card in the list of threads) marks the thread read, as both old
// trees' cards decide it.

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
