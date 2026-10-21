import {
    chatIdentifierToString,
    chatMatchesSearch,
    getDisplayDate,
    latestMessageExpired,
    type ChatSummary,
    type UserLookup,
} from "@client";
import type ChatListPanel from "@openchat/ui/src/features/components/ChatListPanel.svelte";
import type { ComponentProps } from "svelte";
import { pickById } from "../../pickById";

// ChatSummary to ChatListPanel's rows (DATA.md, ChatListPanel rows). The client's lookups (names,
// message text, dates, unread counts) come in through RowContext, so this stays pure.

export type ChatListRow = ComponentProps<typeof ChatListPanel>["rows"][number];

export type RowContext = {
    userName: (userId: string) => string;
    /** The latest message as the row shows it (app/src/logic/chats/latestMessagePreview). */
    preview: (chat: ChatSummary) => string;
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
        preview: ctx.preview(chat),
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
 * if it matches the search as the old list's does (chatMatchesSearch: a group's name or
 * description, a direct chat's username or display name).
 */
export function listed(chat: ChatSummary, query: string, users: UserLookup): boolean {
    const q = query.trim().toLowerCase();
    return q === "" ? !chat.membership.archived : chatMatchesSearch(q, chat, users);
}
