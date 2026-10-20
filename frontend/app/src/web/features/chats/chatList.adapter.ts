import {
    chatIdentifierToString,
    getDisplayDate,
    latestMessageExpired,
    type ChatSummary,
    type MessageContent,
} from "@client";
import type ChatListPanel from "@openchat/ui/src/features/components/ChatListPanel.svelte";
import type { ComponentProps } from "svelte";
import { pickById } from "../../pickById";

// ChatSummary to ChatListPanel's rows (DATA.md, ChatListPanel rows). The client's lookups (names,
// message text, dates, unread counts) come in through RowContext, so this stays pure.

export type ChatListRow = ComponentProps<typeof ChatListPanel>["rows"][number];

export type RowContext = {
    /** The signed-in user's id. */
    me: string;
    /** "You", in the app's language: a group preview's sender when it's the reader. */
    you: string;
    userName: (userId: string) => string;
    /** A message's content as the text a preview shows, in the app's language. */
    contentText: (content: MessageContent) => string;
    /** A chat's display date as the list shows it (a time today, else a short date). */
    date: (timestamp: bigint) => string;
    unread: (chat: ChatSummary) => number;
    /** The pinned chats in the list's scope (chatIdentifierToString). */
    pinned: ReadonlySet<string>;
    /** The selected chat (chatIdentifierToString), if any. */
    selected?: string;
};

// ChatRow's avatar swatches: chats have uploaded avatars rather than the design's colours, so one
// is picked from the id (GAPS.md, Swatches)
const SWATCHES = ["violet", "blue", "teal", "amber", "plum"] as const;

export function swatchFor(id: string): (typeof SWATCHES)[number] {
    return pickById(id, SWATCHES);
}

export function chatTitle(chat: ChatSummary, ctx: Pick<RowContext, "userName">): string {
    return chat.kind === "direct_chat" ? ctx.userName(chat.them.userId) : chat.name;
}

/**
 * The latest message as a preview line; in a group or channel, after its sender's name. Nothing
 * for a disappearing message that has gone (as the old row).
 */
export function chatPreview(chat: ChatSummary, ctx: RowContext, now = Date.now()): string {
    const latest = chat.latestMessage?.event;
    if (latest === undefined || latestMessageExpired(chat, now)) return "";
    const text = ctx.contentText(latest.content);
    if (chat.kind === "direct_chat") return text;
    const sender = latest.sender === ctx.me ? ctx.you : ctx.userName(latest.sender);
    return `${sender}: ${text}`;
}

/** A chat's unread count; none once its latest message has disappeared (as the old row). */
export function unreadCount(chat: ChatSummary, ctx: Pick<RowContext, "unread">, now = Date.now()) {
    return latestMessageExpired(chat, now) ? 0 : ctx.unread(chat);
}

export function chatRow(chat: ChatSummary, ctx: RowContext, now = Date.now()): ChatListRow {
    const id = chatIdentifierToString(chat.id);
    const pinned = ctx.pinned.has(id);
    return {
        id,
        title: chatTitle(chat, ctx),
        preview: chatPreview(chat, ctx, now),
        time: ctx.date(getDisplayDate(chat)),
        kind:
            chat.kind === "direct_chat" ? "user" : chat.kind === "group_chat" ? "group" : "channel",
        color: swatchFor(id),
        unreadCount: unreadCount(chat, ctx, now),
        muted: chat.membership.notificationsMuted,
        pinned,
        section: pinned ? "Pinned" : "Recent",
        liveCall: chat.videoCallInProgress !== undefined ? "video" : "",
        selected: ctx.selected === id,
    };
}

/**
 * Whether a chat is in the list: an archived one only while a search is on, and then a chat only
 * if its title has the search text (as the old list, and as ChatListPanel's own search does).
 */
export function listed(chat: ChatSummary, title: string, query: string): boolean {
    const q = query.trim().toLowerCase();
    return q === "" ? !chat.membership.archived : title.toLowerCase().includes(q);
}

/** An archived chat with unread messages comes back out of the archive (as the old row). */
export function unarchives(chat: ChatSummary, unread: number): boolean {
    return chat.membership.archived && unread > 0;
}
