import {
    chatMatchesSearch,
    type BotMatch,
    type ChatListSearchResults,
    type ChatSummary,
    type UserLookup,
    type UserSummary,
} from "@client";
import { trimLeadingAtSymbol } from "@src/utils/user";

// Searching from the chat list (native design notes §3.2): the user's chats that match, and people
// found on OpenChat who aren't a chat yet. Message search across chats is still to come (GAPS).

/** What the search looks for: the text without spaces at either end or a leading @, lower case. */
export function searchTerm(query: string): string {
    return trimLeadingAtSymbol(query.trim()).trim().toLowerCase();
}

/**
 * The chats that match, in the list's order, archived ones included (as the chat list's own
 * search, `listed`): a group's name or description, a DM's username or display name.
 */
export function matchingChats(
    chats: readonly ChatSummary[],
    term: string,
    users: UserLookup,
): ChatSummary[] {
    return term === "" ? [] : chats.filter((chat) => chatMatchesSearch(term, chat, users));
}

/**
 * The people found who aren't a chat yet: not the user, and nobody they already have a DM with
 * (that's a chat result).
 */
export function newPeople(
    found: readonly UserSummary[],
    chats: readonly ChatSummary[],
    me: string,
): UserSummary[] {
    const inChats = new Set(
        chats.flatMap((chat) => (chat.kind === "direct_chat" ? [chat.them.userId] : [])),
    );
    return found.filter((user) => user.userId !== me && !inChats.has(user.userId));
}

/**
 * What a chat list search found (the client's searchChatList) that isn't a chat already: the
 * people not the user and not already a DM (`newPeople`), the bots not already a DM, and the
 * public groups not already a chat (the user's, or one they're previewing). `chats` are the ones
 * to leave out: a scope's list, with every chat the user has or is previewing in any scope (the
 * client's allServerChatsStore: its DMs, groups and group previews), so a group previewed from
 * the Chats list isn't new in a community or in Favourites either.
 */
export function outsideList(
    found: ChatListSearchResults,
    chats: readonly ChatSummary[],
    me: string,
): ChatListSearchResults {
    const dms = new Set(
        chats.flatMap((chat) => (chat.kind === "direct_chat" ? [chat.them.userId] : [])),
    );
    const groups = new Set(
        chats.flatMap((chat) => (chat.kind === "group_chat" ? [chat.id.groupId] : [])),
    );
    return {
        users: newPeople(found.users, chats, me),
        bots: found.bots.filter((bot) => !dms.has(bot.id)),
        groups: found.groups.filter((match) => !groups.has(match.chatId.groupId)),
    };
}

/** A bot's avatar: its own, else the app's bot picture (as the old trees show it). */
export function botAvatarUrl(bot: Pick<BotMatch, "avatarUrl">): string {
    return bot.avatarUrl ?? "/assets/bot_avatar.svg";
}

/** A section of results: its first `cap` until it's expanded (Show all), and whether there's more. */
export type ResultSection<T> = { rows: T[]; total: number; more: boolean };

export function resultSection<T>(
    rows: readonly T[],
    cap: number,
    expanded: boolean,
): ResultSection<T> {
    return {
        rows: expanded ? [...rows] : rows.slice(0, cap),
        total: rows.length,
        more: rows.length > cap,
    };
}

/**
 * Where a search result's text matches: the text split around the first match of `term` (a search
 * term, lower case), for the match to be shown in bold. No match, and it's all `before`.
 */
export function splitAtMatch(
    text: string,
    term: string,
): { before: string; match: string; after: string } {
    const lower = text.toLowerCase();
    // lower case can change a text's length (İ), and then the positions don't carry over
    const at = term === "" || lower.length !== text.length ? -1 : lower.indexOf(term);
    if (at < 0) return { before: text, match: "", after: "" };
    return {
        before: text.slice(0, at),
        match: text.slice(at, at + term.length),
        after: text.slice(at + term.length),
    };
}
