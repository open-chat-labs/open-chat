import type {
    EventWrapper,
    GiphyContent,
    ImageContent,
    MemeFighterContent,
    Message,
    MessageContent,
    VideoContent,
} from "@client";
import type { GroupMessage, MenuItem } from "@openchat/ui/src/lib/types";
import type { ChatMenuAction } from "@src/logic/chats/chatMenu";
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
    /** How media shows: low bandwidth, and the media URL as this device fetches it. */
    media: MediaView;
};

export type MediaView = {
    lowBandwidth: boolean;
    /** Whether the reader asked to see this message's full-size media (low bandwidth). */
    revealed: (messageId: bigint) => boolean;
    url: (blobUrl: string | undefined) => string | undefined;
};

export type MessageStatus = "sending" | "sent" | "delivered" | "failed";

/**
 * The old bubbles' ticks as the design's status: failed, still on its way (not yet accepted;
 * the old trees show a sent tick once it is, confirmed or not), read by the other person in a DM
 * ("delivered", the design's double tick), or sent.
 */
export function messageStatus(state: {
    failed: boolean;
    accepted: boolean;
    readByThem: boolean;
}): MessageStatus {
    if (state.failed) return "failed";
    if (!state.accepted) return "sending";
    return state.readByThem ? "delivered" : "sent";
}

export type MessageRow = {
    side: "sent" | "received";
    senderName: string;
    color: SenderColor;
    message: GroupMessage;
};

type MediaKind = "image" | "video" | "gif";
export type MediaContent = ImageContent | VideoContent | GiphyContent | MemeFighterContent;

export function isMedia(content: MessageContent): content is MediaContent {
    return (
        content.kind === "image_content" ||
        content.kind === "video_content" ||
        content.kind === "giphy_content" ||
        content.kind === "meme_fighter_content"
    );
}

const MEME_FALLBACK = "/assets/memefighter.svg";

/**
 * An image, video, GIF or meme as MediaMessage's tile. In low bandwidth an image's or GIF's
 * full-size URL isn't handed over until the reader asks for it (5a invariant 1): an image shows
 * its thumbnail, a GIF nothing, until it's revealed.
 */
export function mediaTile(
    content: MediaContent,
    hidden: boolean,
    url: MediaView["url"],
): { kind: MediaKind; items: { src?: string; w?: number; h?: number }[]; caption: string } {
    switch (content.kind) {
        case "image_content":
            return {
                kind: "image",
                items: [
                    {
                        src: hidden ? content.thumbnailData : url(content.blobUrl),
                        w: content.width,
                        h: content.height,
                    },
                ],
                caption: content.caption ?? "",
            };
        case "meme_fighter_content":
            return {
                kind: "image",
                items: [{ src: content.url || MEME_FALLBACK, w: content.width, h: content.height }],
                caption: "",
            };
        case "giphy_content":
            // the desktop rendition is a video; the tile is the GIF image
            return {
                kind: "gif",
                items: [
                    {
                        src: hidden ? undefined : content.mobile.url,
                        w: content.mobile.width,
                        h: content.mobile.height,
                    },
                ],
                caption: content.caption ?? "",
            };
        case "video_content":
            return {
                kind: "video",
                items: [
                    {
                        src: url(content.imageData.blobUrl) ?? content.thumbnailData,
                        w: content.width,
                        h: content.height,
                    },
                ],
                caption: content.caption ?? "",
            };
    }
}

/** A message's text: a text message's own, and for other kinds (until they're built) their text. */
export function messageText(
    content: MessageContent,
    ctx: Pick<ConversationContext, "contentText">,
) {
    return content.kind === "text_content" ? content.text : ctx.contentText(content);
}

/**
 * A message as MessageGroup shows it, with its sender. Every kind shows as a text bubble for now:
 * the rich kinds are phase 5 (GAPS.md).
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
    if (isMedia(msg.content)) {
        const hidden = ctx.media.lowBandwidth && !ctx.media.revealed(msg.messageId);
        const tile = mediaTile(msg.content, hidden, ctx.media.url);
        return {
            side: mine ? "sent" : "received",
            senderName: mine ? ctx.you : ctx.userName(msg.sender),
            color: senderColor(msg.sender),
            message: {
                id: String(msg.messageId),
                ...tile,
                time: ctx.time(evt.timestamp),
                // the tile shows a failed send itself
                status: status === "failed" ? null : status,
                upload: status === "failed" ? { state: "failed" as const } : null,
                deleted: false,
                reactions: msg.reactions.map((r) => ({
                    emoji: r.reaction,
                    count: r.userIds.size,
                    mine: r.userIds.has(ctx.me),
                })),
            },
        };
    }
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

/** How long until the next local day starts, so labels like "Today" can be redone then. */
export function untilNextDay(now: Date): number {
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return next.getTime() - now.getTime();
}

// ── the header's menu ──

type HeaderMenuItem = MenuItem & { id: string };

const K = "ui.conversationHeader.menu.";
const icon = (name: string) => `var(--icon-${name}) center/contain no-repeat`;

export type HeaderMenuState = {
    kind: "user" | "group" | "channel";
    favourite: boolean;
    muted: boolean;
    everyoneMuted: boolean;
    /** A DM with a bot can't be muted. */
    isBot: boolean;
    /** There are unread messages to mark as read. */
    unread: boolean;
    /** Leave, delete, block and unblock, as logic/chats/chatMenu offers them. */
    actions: ChatMenuAction[];
    /** "Unblock user", which the library has no words for. */
    unblockLabel: string;
    /** Someone who can edit the group or channel: "Manage", else its details. */
    canEdit: boolean;
};

/**
 * ConversationHeader's menu, as the design's (`_chatMenu`): for a group or channel, Manage (or its
 * details), favourite, mute, @everyone, mark as read and copy link, then leave; for a DM,
 * favourite, mute, chat settings, then block and delete. Leave, delete, block and unblock show only where the
 * app allows them. Picking one reports its id (`onMenu`, or `onLeave`).
 */
export function headerMenuItems(state: HeaderMenuState): HeaderMenuItem[] {
    const group = state.kind !== "user";
    const noun = state.kind === "channel" ? "Channel" : "Group";
    const items: HeaderMenuItem[] = [];
    if (group) {
        items.push({
            id: "manage",
            label: K + (state.canEdit ? `manage${noun}` : `${noun.toLowerCase()}Details`),
            mask: icon(state.canEdit ? "gear" : "info"),
        });
    }
    items.push(
        state.favourite
            ? { id: "unfavourite", label: K + "removeFromFavourites", mask: icon("heart") }
            : { id: "favourite", label: K + "addToFavourites", mask: icon("heart") },
    );
    if (!state.isBot) {
        items.push(
            state.muted
                ? { id: "unmute", label: K + "unmuteNotifications", mask: icon("bell") }
                : { id: "mute", label: K + "muteNotifications", mask: icon("bell-off") },
        );
    }
    if (!group) {
        items.push({ id: "chatSettings", label: K + "chatSettings", mask: icon("gear") });
    }
    if (group) {
        items.push(
            state.everyoneMuted
                ? { id: "unmuteEveryone", label: K + "unmuteEveryone", mask: icon("at") }
                : { id: "muteEveryone", label: K + "muteEveryone", mask: icon("at") },
        );
        if (state.unread) {
            items.push({ id: "markRead", label: K + "markAsRead", mask: icon("check") });
        }
        items.push({ id: "copyUrl", label: K + "copyUrl", mask: icon("link") });
    }
    for (const action of state.actions) {
        items.push(actionItem(action, state));
    }
    return items;
}

/** The quick panel's menu: the header's without what the panel shows as buttons (favourite,
 *  mute, @everyone) or its own cog (Manage), as the design's `_panelMenu`. */
export function panelMenuItems(state: HeaderMenuState): HeaderMenuItem[] {
    const shown = new Set([
        "manage",
        "favourite",
        "unfavourite",
        "mute",
        "unmute",
        "muteEveryone",
        "unmuteEveryone",
    ]);
    return headerMenuItems(state).filter((item) => !shown.has(item.id));
}

function actionItem(action: ChatMenuAction, state: HeaderMenuState): HeaderMenuItem {
    switch (action) {
        case "leave":
            return {
                id: "leave",
                label: K + (state.kind === "channel" ? "leaveChannel" : "leaveGroup"),
                mask: icon("exit"),
                variant: "danger",
            };
        case "delete":
            return {
                id: "delete",
                label: K + "deleteChat",
                mask: icon("trash"),
                variant: "danger",
            };
        case "block":
            return { id: "block", label: K + "blockUser", mask: icon("ban"), variant: "danger" };
        case "unblock":
            return { id: "unblock", label: state.unblockLabel, mask: icon("ban") };
    }
}
