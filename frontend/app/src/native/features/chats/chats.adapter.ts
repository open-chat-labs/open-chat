import {
    chatIdentifierToString,
    type BotMatch,
    type ChatListSearchResults,
    type ChatSummary,
    type GroupMatch,
    type UserSummary,
} from "@client";
import type { NativeMenuItem } from "@openchat/ui/src/native/types";
import type { ChatRowAction } from "@src/logic/chats/chatMenu";
import { swatchFor, type ChatListRow, type Swatch } from "@src/logic/chats/chatRow";
import {
    outsideList,
    resultSection,
    splitAtMatch,
    type ResultSection,
} from "@src/logic/chats/chatSearch";

// The Chats tab's data as the native kit and the library take it (native design notes §3.2). The
// words come in from the screen (`label`), translated, as the kit shows its rows' labels as they are.

/**
 * ChatRow's props for a list row (`chatRow`), with the favourite's heart. The row's avatar and
 * unread mentions (the web's, L1) aren't shown here yet.
 */
export type NativeChatRow = Omit<
    ChatListRow,
    "id" | "section" | "selected" | "avatarUrl" | "mentions"
> & {
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
        suspended: row.suspended,
        titleLoading: row.titleLoading,
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
    /** `sub` is markdown (a chat's latest message, as the list's rows have it), not plain text. */
    subMarkdown: boolean;
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
        subMarkdown: handle === undefined,
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
        subMarkdown: false,
        kind: "user",
        color: swatchFor(chatIdentifierToString({ kind: "direct_chat", userId: user.userId })),
    };
}

/** A bot that takes direct chats, found by the search: its name over its description. */
export function botResult(bot: BotMatch, term: string): ResultRow {
    return {
        id: bot.id,
        title: splitAtMatch(bot.name, term),
        sub: bot.definition.description,
        subMarkdown: false,
        kind: "user",
        // its DM's swatch, as a person's
        color: swatchFor(chatIdentifierToString({ kind: "direct_chat", userId: bot.id })),
    };
}

/** A public group found (one the user isn't in): its name over its member count (`members`). */
export function groupResult(group: GroupMatch, members: string, term: string): ResultRow {
    return {
        id: group.chatId.groupId,
        title: splitAtMatch(group.name, term),
        sub: members,
        subMarkdown: false,
        kind: "group",
        color: swatchFor(chatIdentifierToString(group.chatId)),
    };
}

export type FoundResultsInput = {
    /** What the search on OpenChat found (the client's searchChatList, with public groups). */
    found: ChatListSearchResults;
    /**
     * The user's chats to leave out: the list's, with every chat they have or are previewing in
     * any scope (allServerChatsStore), less those waiting to be left or deleted.
     */
    chats: readonly ChatSummary[];
    me: string;
    term: string;
    /** A user's name as the app shows it. */
    userName: (user: UserSummary) => string;
    /** A group's member count, in the app's words. */
    members: (count: number) => string;
};

export type FoundResults = { people: ResultRow[]; groups: ResultRow[] };

/**
 * The search's People and Public groups: what was found that isn't a chat already (`outsideList`,
 * as the web's chat list search). People are the people found, then the bots that take direct
 * chats (as the web's and the old mobile search's); Public groups the groups the user isn't in or
 * previewing (those are under Chats).
 */
export function foundResults(input: FoundResultsInput): FoundResults {
    const { term } = input;
    const outside = outsideList(input.found, input.chats, input.me);
    return {
        people: [
            ...outside.users.map((user) => personResult(user, input.userName(user), term)),
            ...outside.bots.map((bot) => botResult(bot, term)),
        ],
        groups: outside.groups.map((group) =>
            groupResult(group, input.members(group.memberCount), term),
        ),
    };
}

/** The search's sections, in their order. */
export const SEARCH_SECTIONS = ["chats", "people", "groups"] as const;
export type SearchSectionId = (typeof SEARCH_SECTIONS)[number];

/** How many of a section's rows show until Show all. */
export const SEARCH_SECTION_CAP = 3;

/**
 * The search's sections with something in them, in order (Chats, People, Public groups), each its
 * first few (`SEARCH_SECTION_CAP`) until it's expanded (Show all).
 */
export function searchSections(
    rows: Record<SearchSectionId, readonly ResultRow[]>,
    expanded: Partial<Record<string, boolean>>,
): { id: SearchSectionId; section: ResultSection<ResultRow> }[] {
    return SEARCH_SECTIONS.map((id) => ({
        id,
        section: resultSection(rows[id], SEARCH_SECTION_CAP, expanded[id] ?? false),
    })).filter(({ section }) => section.total > 0);
}
