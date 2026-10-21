import type { EventWrapper, Message, MessageContent } from "@client";
import type { GroupMessage } from "@openchat/ui/src/lib/types";
import { pickById } from "../../pickById";

// A conversation's messages to MessageGroup's messages (DATA.md, Conversation). The timeline's
// other events are worded by logic/conversation/timelineEventText, as in the old trees. The
// client's lookups (names, text, dates) come in through ConversationContext, so this stays pure.

export type SenderColor = "violet" | "amber" | "teal" | "blue";

// senders have uploaded avatars rather than the design's colours, so one is picked from the id
// (GAPS.md, Swatches)
const COLOURS: readonly SenderColor[] = ["violet", "amber", "teal", "blue"];

export function senderColor(id: string): SenderColor {
    return pickById(id, COLOURS);
}

export type ConversationContext = {
    /** The signed-in user's id. */
    me: string;
    /** "You", in the app's language. */
    you: string;
    userName: (userId: string) => string;
    /** A message's content as text, in the app's language (for kinds not shown yet, and quotes). */
    contentText: (content: MessageContent) => string;
    /** A message's time, as its bubble shows it. */
    time: (timestamp: bigint) => string;
    /** A date as the list shows it (a time today, else a short date). */
    date: (timestamp: bigint) => string;
};

export type MessageStatus = "sending" | "sent" | "delivered" | "failed";

/**
 * Where a message has got to, as the bubble's tick shows it: failed, still on its way (not yet
 * confirmed, or not yet accepted), read by the other person in a DM ("delivered", the design's
 * double tick), or sent.
 */
export function messageStatus(state: {
    failed: boolean;
    confirmed: boolean;
    accepted: boolean;
    readByThem: boolean;
}): MessageStatus {
    if (state.failed) return "failed";
    if (!state.confirmed || !state.accepted) return "sending";
    return state.readByThem ? "delivered" : "sent";
}

export type MessageRow = {
    side: "sent" | "received";
    senderName: string;
    color: SenderColor;
    message: Extract<GroupMessage, { kind?: "text" }>;
};

/** A message's text: a text message's own, and for other kinds (until they're built) their text. */
export function messageText(
    content: MessageContent,
    ctx: Pick<ConversationContext, "contentText">,
) {
    return content.kind === "text_content" ? content.text : ctx.contentText(content);
}

/**
 * A message as MessageGroup shows it, with its sender. Every kind shows as a text bubble for now:
 * the rich kinds are phase 6 (GAPS.md).
 */
export function messageRow(
    evt: EventWrapper<Message>,
    status: MessageStatus,
    ctx: ConversationContext,
): MessageRow {
    const msg = evt.event;
    const mine = msg.sender === ctx.me;
    const reply = msg.repliesTo;
    const quoted = reply?.kind === "rehydrated_reply_context" ? reply : undefined;
    const thread = msg.thread;
    return {
        side: mine ? "sent" : "received",
        senderName: mine ? ctx.you : ctx.userName(msg.sender),
        color: senderColor(msg.sender),
        message: {
            id: String(msg.messageId),
            kind: "text",
            text: messageText(msg.content, ctx),
            time: ctx.time(evt.timestamp),
            status,
            // a bot's message is edited as it's finalised, which isn't an edit to show
            edited:
                msg.edited && !(msg.senderContext?.kind === "bot" && msg.senderContext.finalised),
            forwarded: msg.forwarded,
            deleted: msg.content.kind === "deleted_content",
            reactions: msg.reactions.map((r) => ({
                emoji: r.reaction,
                count: r.userIds.size,
                mine: r.userIds.has(ctx.me),
            })),
            quoteName:
                quoted === undefined
                    ? undefined
                    : quoted.senderId === ctx.me
                      ? ctx.you
                      : ctx.userName(quoted.senderId),
            quoteText: quoted === undefined ? undefined : messageText(quoted.content, ctx),
            threadCount: thread?.numberOfReplies ?? 0,
            threadLastAt: thread === undefined ? undefined : ctx.date(thread.latestEventTimestamp),
        },
    };
}

/**
 * `messageRow`, kept per row while nothing it shows changes (the event, its status and the names
 * in it), so a row stays the same object, and its bubble isn't redone, as users and other chat
 * state update. Clear it when the wording or the chat changes.
 */
export class MessageRows {
    #rows = new Map<
        string,
        { evt: EventWrapper<Message>; status: MessageStatus; names: string; row: MessageRow }
    >();

    row(
        key: string,
        evt: EventWrapper<Message>,
        status: MessageStatus,
        ctx: ConversationContext,
    ): MessageRow {
        const msg = evt.event;
        const reply = msg.repliesTo;
        const name = (userId: string) => (userId === ctx.me ? ctx.you : ctx.userName(userId));
        const names = `${name(msg.sender)}\n${reply?.kind === "rehydrated_reply_context" ? name(reply.senderId) : ""}`;
        const cached = this.#rows.get(key);
        if (cached?.evt === evt && cached.status === status && cached.names === names) {
            return cached.row;
        }
        const row = messageRow(evt, status, ctx);
        this.#rows.set(key, { evt, status, names, row });
        return row;
    }

    clear(): void {
        this.#rows.clear();
    }
}

/** How long until the next local day starts, so labels like "Today" can be redone then. */
export function untilNextDay(now: Date): number {
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return next.getTime() - now.getTime();
}
