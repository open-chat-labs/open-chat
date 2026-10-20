import {
    chatIdentifierToString,
    messageContextToChatListScope,
    messageContextToString,
    routeForMessage,
    type Message,
    type MessageActivityEvent,
    type MessageContent,
    type MessageContext,
} from "@client";
import type { ActivityItem } from "@openchat/ui/src/features/components/ActivityPanel.svelte";
import { pickById } from "../../pickById";

// The activity feed's events to ActivityPanel's items (DATA.md, ActivityPanel), in the old feed's
// words (ActivityEvent.svelte). The client's lookups and wording come in through ActivityContext,
// so this stays pure.

export type ActivityContext = {
    /** The signed-in user's id. */
    me: string;
    /** "you", in the app's language, for the reader among the others. */
    you: string;
    /** "An anonymous user", for an event without a user. */
    anon: string;
    /** "Message content unavailable", for an event without its message. */
    missing: string;
    userName: (userId: string) => string;
    /** The chat an event happened in, as the old feed named it ("Community > channel"). */
    chatName: (context: MessageContext) => string | undefined;
    contentText: (content: MessageContent) => string;
    /** The app's wording for a key, with its values. */
    t: (key: string, values?: Record<string, string | number>) => string;
    /** A day heading ("Today", "Yesterday", a date) and a time, as the app formats them. */
    day: (timestamp: bigint) => string;
    time: (timestamp: bigint) => string;
    /** Events after this have not been read. */
    readUpTo: bigint;
};

// people with avatars upload them, so a colour is picked from the id (GAPS.md, Swatches)
const COLOURS: readonly NonNullable<ActivityItem["color"]>[] = [
    "violet",
    "blue",
    "teal",
    "amber",
    "plum",
];

const TYPES: Record<MessageActivityEvent["activity"], ActivityItem["type"]> = {
    mention: "mention",
    reaction: "reaction",
    quote_reply: "reply",
    tip: "payment",
    crypto: "payment",
    p2p_swap_accepted: "payment",
    // not one of the panel's kinds: shown under All only
    poll_vote: undefined,
};

/** An event's id: its message, where in the chat, and what happened (the old feed's key). */
export function activityId(event: MessageActivityEvent): string {
    return `${messageContextToString(event.messageContext)}_${event.eventIndex}_${event.activity}`;
}

export function activityItem(event: MessageActivityEvent, ctx: ActivityContext): ActivityItem {
    const id = activityId(event);
    const message = event.message;
    return {
        id,
        day: ctx.day(event.timestamp),
        title: activitySummary(event, ctx),
        context: ctx.chatName(event.messageContext) ?? "",
        preview:
            message === undefined
                ? ctx.missing
                : `${name(message.sender, ctx)}: ${ctx.contentText(message.content)}`,
        time: ctx.time(event.timestamp),
        unread: event.timestamp > ctx.readUpTo,
        color: pickById(event.userId ?? id, COLOURS),
        kind: "user",
        reactions:
            event.activity === "reaction" ? (message?.reactions.map((r) => r.reaction) ?? []) : [],
        type: TYPES[event.activity],
        chatId: chatIdentifierToString(event.messageContext.chatId),
        messageId: String(event.messageId),
    };
}

/**
 * Where opening an event goes: its message, with the feed still open beside it, unless the screen
 * is narrow, where only one column shows and the message is what was asked for.
 */
export function activityLink(event: MessageActivityEvent, keepFeed = true): string {
    const route = routeForMessage(
        messageContextToChatListScope(event.messageContext).kind,
        event.messageContext,
        event.messageIndex,
    );
    return keepFeed ? `${route}${route.includes("?") ? "&" : "?"}panel=activity` : route;
}

function name(userId: string, ctx: ActivityContext): string {
    return userId === ctx.me ? ctx.you : ctx.userName(userId);
}

/** What happened, in the old feed's words: who did it, and how many others did too. */
export function activitySummary(event: MessageActivityEvent, ctx: ActivityContext): string {
    const username = event.userId === undefined ? ctx.anon : name(event.userId, ctx);
    switch (event.activity) {
        case "reaction":
            return withOthers("reaction", username, otherReactors(event, ctx.me), ctx);
        case "tip":
            return withOthers("tip", username, otherTippers(event), ctx);
        case "mention":
            return ctx.t("activity.mention", { username });
        case "quote_reply":
            return ctx.t("activity.quoteReply", { username });
        case "crypto":
            return ctx.t("activity.crypto", { username });
        case "p2p_swap_accepted":
            return ctx.t("activity.p2pSwapAccepted", { username });
        case "poll_vote": {
            const voters = pollVoters(event.message);
            return voters > 1
                ? ctx.t("activity.pollVoteN", { username, number: voters - 1 })
                : ctx.t("activity.pollVote", { username });
        }
    }
}

function withOthers(
    root: "tip" | "reaction",
    username: string,
    others: Set<string>,
    ctx: ActivityContext,
): string {
    switch (others.size) {
        case 0:
            return ctx.t(`activity.${root}One`, { username });
        case 1:
            return ctx.t(`activity.${root}Two`, { username, other: name([...others][0], ctx) });
        default:
            return ctx.t(`activity.${root}N`, { username, n: others.size });
    }
}

function otherReactors(event: MessageActivityEvent, me: string): Set<string> {
    return new Set(
        (event.message?.reactions ?? []).flatMap((r) =>
            [...r.userIds].filter((u) => u !== event.userId && u !== me),
        ),
    );
}

function otherTippers(event: MessageActivityEvent): Set<string> {
    return new Set(
        Object.values(event.message?.tips ?? {}).flatMap((tips) =>
            Object.keys(tips).filter((u) => u !== event.userId),
        ),
    );
}

function pollVoters(message: Message | undefined): number {
    if (message?.content.kind !== "poll_content") return 1;
    const total = message.content.votes.total;
    switch (total.kind) {
        case "anonymous_poll_votes":
            return Object.values(total.votes).reduce((sum, n) => sum + n, 0);
        case "hidden_poll_votes":
            return total.votes;
        case "visible_poll_votes":
            return Object.values(total.votes).reduce((sum, voters) => sum + voters.length, 0);
    }
}

/** The newest of these events' times: marking them read marks everything up to it. */
export function readUpTo(events: MessageActivityEvent[]): bigint | undefined {
    return events.reduce<bigint | undefined>(
        (latest, ev) => (latest === undefined || ev.timestamp > latest ? ev.timestamp : latest),
        undefined,
    );
}
