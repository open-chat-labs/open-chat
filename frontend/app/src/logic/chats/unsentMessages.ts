import {
    chatIdentifierToString,
    getDisplayDate,
    type ChatSummary,
    type EventWrapper,
    type Message,
    type MessageContext,
} from "@client";

// A chat list row shows the latest message the user has tried to send there when it's newer
// than the chat's latest confirmed one: on its way (sending, or queued for the connection) or
// failed. The row's preview ("You: …"), its time and its place in the list follow it, as the
// conversation does (#10591). Only the new UIs' lists read it; the old trees' rows show the latest
// confirmed message, as they always have.

/** How an unsent message stands: on its way (or waiting for the connection), or failed. */
export type UnsentStatus = "sending" | "failed";

export type UnsentMessage = { event: EventWrapper<Message>; status: UnsentStatus };

/** A store's messages by where they are (localUpdates' unconfirmed and failed messages). */
type ByContext<V> = { entries(): Iterable<[MessageContext, V]> };
type Messages = { values(): Iterable<EventWrapper<Message>> };

/**
 * The latest message the user sent in each chat that the backend doesn't have yet, by chat
 * (`chatIdentifierToString`): the newest of the unconfirmed and failed ones in the chat itself
 * (not in its threads, which a row doesn't show). A failed one is `failed` unless it's queued
 * for the connection, which, like one being sent, is `sending`.
 */
export function latestUnsentByChat(
    unconfirmed: ByContext<Messages>,
    failed: ByContext<Messages>,
    queued: ByContext<ReadonlySet<bigint>>,
): Map<string, UnsentMessage> {
    const queuedIds = new Set<bigint>();
    for (const [context, ids] of queued.entries()) {
        if (context.threadRootMessageIndex === undefined) ids.forEach((id) => queuedIds.add(id));
    }
    const latest = new Map<string, UnsentMessage>();
    const consider = (
        context: MessageContext,
        event: EventWrapper<Message>,
        status: UnsentStatus,
    ) => {
        if (context.threadRootMessageIndex !== undefined) return;
        const key = chatIdentifierToString(context.chatId);
        const current = latest.get(key);
        if (current === undefined || event.timestamp > current.event.timestamp) {
            latest.set(key, { event, status });
        }
    };
    for (const [context, messages] of unconfirmed.entries()) {
        for (const event of messages.values()) consider(context, event, "sending");
    }
    for (const [context, messages] of failed.entries()) {
        for (const event of messages.values()) {
            consider(context, event, queuedIds.has(event.event.messageId) ? "sending" : "failed");
        }
    }
    return latest;
}

/**
 * The chat's unsent message, if it's newer than the chat's latest confirmed one, or is the chat's
 * latest itself (the client puts a message on its way in the summary).
 */
export function unsentFor(
    chat: ChatSummary,
    unsent: ReadonlyMap<string, UnsentMessage>,
): UnsentMessage | undefined {
    const message = unsent.get(chatIdentifierToString(chat.id));
    if (message === undefined) return undefined;
    const latest = chat.latestMessage;
    // the client puts a message on its way in the chat's summary itself (mergeUnconfirmedIntoSummary)
    if (latest === undefined || latest.event.messageId === message.event.event.messageId) {
        return message;
    }
    return message.event.timestamp > latest.timestamp ? message : undefined;
}

/** The chat as its row shows it: its latest message the unsent one. */
export function withUnsent(chat: ChatSummary, unsent: UnsentMessage | undefined): ChatSummary {
    return unsent === undefined ? chat : { ...chat, latestMessage: unsent.event };
}

/**
 * A chat list's order with its unsent messages: the pinned chats first, as they were, then the
 * rest by their latest message, an unsent one included (`getDisplayDate`), newest first. Chats
 * the unsent messages don't move keep their order.
 */
export function orderWithUnsent(
    ordered: readonly ChatSummary[],
    pinned: ReadonlySet<string>,
    unsent: ReadonlyMap<string, UnsentMessage>,
): ChatSummary[] {
    if (unsent.size === 0) return [...ordered];
    const pinnedChats: ChatSummary[] = [];
    const rest: [bigint, number, ChatSummary][] = [];
    ordered.forEach((chat, i) => {
        if (pinned.has(chatIdentifierToString(chat.id))) {
            pinnedChats.push(chat);
        } else {
            rest.push([getDisplayDate(withUnsent(chat, unsentFor(chat, unsent))), i, chat]);
        }
    });
    rest.sort(([a, i], [b, j]) => (a === b ? i - j : a < b ? 1 : -1));
    return pinnedChats.concat(rest.map(([, , chat]) => chat));
}
