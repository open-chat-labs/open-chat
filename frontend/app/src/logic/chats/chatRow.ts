import {
    chatIdentifierToString,
    chatMatchesSearch,
    getDisplayDate,
    latestMessageExpired,
    type ChatIdentifier,
    type ChatSummary,
    type OpenChat,
    type UserLookup,
} from "@client";
import { pickById } from "@src/utils/pickById";
import { buildDisplayName } from "@src/utils/user";
import { latestMessagePreview, type PreviewText } from "./latestMessagePreview";

// ChatSummary to a chat list's rows: ChatListPanel's on the web (src/web/DATA.md, ChatListPanel
// rows), ChatRow's in the native Chats tab. The client's lookups (names, message text, dates, unread
// counts) come in through RowContext, so this stays pure.

/** A chat list row: ChatRow's props, with the chat's id and its section (ChatListPanel's). */
export type ChatListRow = {
    /** The chat's id (chatIdentifierToString). */
    id: string;
    title: string;
    preview: string;
    previewIcon: "forward" | undefined;
    time: string;
    kind: "user" | "group" | "channel";
    color: Swatch;
    locked: boolean;
    unreadCount: number;
    muted: boolean;
    pinned: boolean;
    section: "Pinned" | "Chats";
    liveCall: "" | "video";
    selected: boolean;
};

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

/** What a list's RowContext is built from: the stores' values the rows read. */
export type RowContextInputs = Pick<
    PreviewText,
    "formatter" | "me" | "translations" | "bridgedUsers"
> & {
    users: UserLookup;
    /** The list's scope's pinned chats (pinnedChatsStore). */
    pinned: readonly ChatIdentifier[];
    selected?: ChatIdentifier;
};

/**
 * The RowContext every chat list builds from the client and the stores: names as the client shows
 * them, the latest message as `latestMessagePreview` has it, the list's dates, and unread counts.
 */
export function rowContext(
    client: Pick<
        OpenChat,
        "displayName" | "getContentAsText" | "formatMessageDate" | "unreadMessageCount"
    >,
    { formatter, me, users, translations, bridgedUsers, pinned, selected }: RowContextInputs,
): RowContext {
    return {
        userName: (userId) => client.displayName(users.get(userId)),
        preview: (chat) =>
            latestMessagePreview(chat, {
                formatter,
                me,
                displayName: (userId, kind) => buildDisplayName(users, userId, kind, false),
                translations,
                contentText: (content) => client.getContentAsText(formatter, content),
                bridgedUsers,
                users,
            }),
        date: (timestamp) =>
            client.formatMessageDate(
                timestamp,
                formatter("today"),
                formatter("yesterday"),
                true,
                true,
            ),
        unread: (chat) =>
            client.unreadMessageCount(chat.id, chat.latestMessage?.event.messageIndex),
        pinned: new Set(pinned.map(chatIdentifierToString)),
        selected: selected && chatIdentifierToString(selected),
    };
}

// ChatRow's avatar swatches: chats have uploaded avatars rather than the design's colours, so one
// is picked from the id (GAPS.md, Swatches)
const SWATCHES = ["violet", "blue", "teal", "amber", "plum"] as const;
export type Swatch = (typeof SWATCHES)[number];

export function swatchFor(id: string): Swatch {
    return pickById(id, SWATCHES);
}

export function chatTitle(chat: ChatSummary, ctx: Pick<RowContext, "userName">): string {
    return chat.kind === "direct_chat" ? ctx.userName(chat.them.userId) : chat.name;
}

/** A chat's unread count; none once its latest message has disappeared (as the old row). */
export function unreadCount(chat: ChatSummary, ctx: Pick<RowContext, "unread">, now = Date.now()) {
    return latestMessageExpired(chat, now) ? 0 : ctx.unread(chat);
}

/** Whether the preview gets the forward icon: the latest message, still there, was forwarded. */
export function latestForwarded(chat: ChatSummary, now = Date.now()): boolean {
    const latest = chat.latestMessage?.event;
    return (
        latest !== undefined &&
        latest.forwarded &&
        latest.content.kind !== "deleted_content" &&
        !latestMessageExpired(chat, now)
    );
}

export function chatRow(chat: ChatSummary, ctx: RowContext, now = Date.now()): ChatListRow {
    const id = chatIdentifierToString(chat.id);
    const pinned = ctx.pinned.has(id);
    return {
        id,
        title: chatTitle(chat, ctx),
        preview: ctx.preview(chat),
        previewIcon: latestForwarded(chat, now) ? "forward" : undefined,
        time: ctx.date(getDisplayDate(chat)),
        kind:
            chat.kind === "direct_chat" ? "user" : chat.kind === "group_chat" ? "group" : "channel",
        color: swatchFor(id),
        // a private group or channel shows a lock
        locked: chat.kind !== "direct_chat" && !chat.public,
        unreadCount: unreadCount(chat, ctx, now),
        muted: chat.membership.notificationsMuted,
        pinned,
        section: pinned ? "Pinned" : "Chats",
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
