import { chatIdentifierToString, type ChatSummary, type UserSummary } from "@client";
import type { NativeMenuItem } from "@openchat/ui/src/native/types";
import type { ChatRowAction } from "@src/logic/chats/chatMenu";
import { swatchFor, type ChatListRow, type Swatch } from "@src/logic/chats/chatRow";
import { splitAtMatch } from "@src/logic/chats/chatSearch";

// The Chats tab's data as the native kit and the library take it (native design notes §3.2). The
// words come in from the screen (`label`), translated, as the kit shows its rows' labels as they are.

/** ChatRow's props for a list row (`chatRow`), with the favourite's heart. */
export type NativeChatRow = Omit<ChatListRow, "id" | "section" | "selected"> & {
    fav: boolean;
};

export function nativeChatRow(row: ChatListRow, favourite: boolean): NativeChatRow {
    return {
        title: row.title,
        preview: row.preview,
        previewIcon: row.previewIcon,
        time: row.time,
        kind: row.kind,
        color: row.color,
        locked: row.locked,
        unreadCount: row.unreadCount,
        muted: row.muted,
        pinned: row.pinned,
        liveCall: row.liveCall,
        fav: favourite,
    };
}

/** The header's kebab menu (AnchoredMenu). */
export const HEADER_MENU_ACTIONS = ["new_group", "mark_all_read"] as const;
export type HeaderMenuAction = (typeof HEADER_MENU_ACTIONS)[number];

export function headerMenuItems(label: (action: HeaderMenuAction) => string): NativeMenuItem[] {
    return [
        { id: "new_group", label: label("new_group"), icon: "users" },
        { id: "mark_all_read", label: label("mark_all_read"), icon: "check-double" },
    ];
}

// the design's icon for each row menu item
const ROW_ICONS: Record<ChatRowAction, string> = {
    pin: "pin",
    unpin: "pin",
    favourite: "heart",
    unfavourite: "heart",
    mute: "bell-off",
    unmute: "bell",
    mark_read: "check",
    archive: "eye-off",
    unarchive: "eye",
    leave: "exit",
    delete: "trash",
    remove: "close",
};

const DANGER: ReadonlySet<ChatRowAction> = new Set<ChatRowAction>(["leave", "delete"]);

/**
 * A row's long-press menu (LongPressMenu): its items (`chatRowMenu`) with the design's icons, the
 * destructive ones in red under a divider.
 */
export function rowMenuItems(
    actions: readonly ChatRowAction[],
    label: (action: ChatRowAction) => string,
): NativeMenuItem[] {
    let separated = false;
    return actions.map((action) => {
        const danger = DANGER.has(action);
        const separator = danger && !separated;
        if (danger) separated = true;
        return { id: action, label: label(action), icon: ROW_ICONS[action], danger, separator };
    });
}

/** The text of a search result's name, split around what matched (shown in bold). */
export type MatchedText = { before: string; match: string; after: string };

/** A search result or a person to start a chat with: avatar, name, and the line under it. */
export type ResultRow = {
    id: string;
    title: MatchedText;
    sub: string;
    kind: "user" | "group" | "channel";
    color: Swatch;
};

/** A chat that matched the search, from its list row (`chatRow`). */
export function chatResult(
    chat: ChatSummary,
    row: ChatListRow,
    term: string,
    username: (userId: string) => string | undefined,
): ResultRow {
    const handle = chat.kind === "direct_chat" ? username(chat.them.userId) : undefined;
    return {
        id: row.id,
        title: splitAtMatch(row.title, term),
        // a DM's @username; a group's or channel's latest message
        sub: handle !== undefined ? `@${handle}` : row.preview,
        kind: row.kind,
        color: row.color,
    };
}

/** A person found (not yet a chat), or one to start a chat with. */
export function personResult(user: UserSummary, name: string, term: string): ResultRow {
    return {
        id: user.userId,
        title: splitAtMatch(name, term),
        sub: `@${user.username}`,
        kind: "user",
        color: swatchFor(chatIdentifierToString({ kind: "direct_chat", userId: user.userId })),
    };
}
