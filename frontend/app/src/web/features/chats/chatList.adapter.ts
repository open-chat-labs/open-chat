import {
    chatIdentifierToString,
    getDisplayDate,
    type ChatSummary,
    type MessageContent,
} from "@client";
import type ChatListPanel from "@openchat/ui/src/features/components/ChatListPanel.svelte";
import type { ComponentProps } from "svelte";

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
    let hash = 0;
    for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
    return SWATCHES[Math.abs(hash) % SWATCHES.length];
}

export function chatTitle(chat: ChatSummary, ctx: Pick<RowContext, "userName">): string {
    return chat.kind === "direct_chat" ? ctx.userName(chat.them.userId) : chat.name;
}

/** The latest message as a preview line; in a group or channel, after its sender's name. */
export function chatPreview(chat: ChatSummary, ctx: RowContext): string {
    const latest = chat.latestMessage?.event;
    if (latest === undefined) return "";
    const text = ctx.contentText(latest.content);
    if (chat.kind === "direct_chat") return text;
    const sender = latest.sender === ctx.me ? ctx.you : ctx.userName(latest.sender);
    return `${sender}: ${text}`;
}

export function chatRow(chat: ChatSummary, ctx: RowContext): ChatListRow {
    const id = chatIdentifierToString(chat.id);
    const pinned = ctx.pinned.has(id);
    return {
        id,
        title: chatTitle(chat, ctx),
        preview: chatPreview(chat, ctx),
        time: ctx.date(getDisplayDate(chat)),
        kind:
            chat.kind === "direct_chat" ? "user" : chat.kind === "group_chat" ? "group" : "channel",
        color: swatchFor(id),
        unreadCount: ctx.unread(chat),
        muted: chat.membership.notificationsMuted,
        pinned,
        section: pinned ? "Pinned" : "Recent",
        liveCall: chat.videoCallInProgress !== undefined ? "video" : "",
        selected: ctx.selected === id,
    };
}
