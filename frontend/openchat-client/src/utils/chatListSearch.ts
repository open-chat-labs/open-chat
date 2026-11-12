import type { BotMatch, GroupMatch, UserSummary } from "@shared";

// The chat list's search on OpenChat, for what isn't in the list: people, bots that take direct
// chats and, when asked for, public groups (the old mobile search's, and the new web UI's at the
// user's request of 2026-11-12: web plan 04 has none). Every tree's chat list search runs it (the
// client's searchChatList).

/** How many of each the search asks for. */
export const CHAT_LIST_SEARCH_MAX = 10;

/** What a chat list search found, in the backend's order. */
export type ChatListSearchResults = {
    users: UserSummary[];
    bots: BotMatch[];
    /** The public groups found; none when the search didn't look for them. */
    groups: GroupMatch[];
};

/**
 * The backend calls a search makes. Each may fail: that one finds nothing. Without `groups` the
 * search doesn't look for public groups.
 */
export type ChatListSearchCalls = {
    users: (term: string) => Promise<UserSummary[]>;
    bots: (term: string) => Promise<BotMatch[]>;
    groups?: (term: string) => Promise<GroupMatch[]>;
};

export function noChatListSearchResults(): ChatListSearchResults {
    return { users: [], bots: [], groups: [] };
}

/** What a search found as one list, as the old trees' chat list search shows it: people, then bots. */
export function chatListSearchMatches(results: ChatListSearchResults): (UserSummary | BotMatch)[] {
    return [...results.users, ...results.bots];
}

/**
 * The people, bots and (with a `groups` call) public groups found for a search term (one with any
 * leading "@" dropped), all asked for at once. An empty term asks the backend nothing and finds
 * nothing.
 */
export async function runChatListSearch(
    term: string,
    calls: ChatListSearchCalls,
): Promise<ChatListSearchResults> {
    if (term === "") return noChatListSearchResults();
    const [users, bots, groups] = await Promise.all([
        orNothing(calls.users(term)),
        orNothing(calls.bots(term)),
        calls.groups === undefined ? Promise.resolve([]) : orNothing(calls.groups(term)),
    ]);
    return { users, bots, groups };
}

async function orNothing<T>(found: Promise<T[]>): Promise<T[]> {
    try {
        return await found;
    } catch (err) {
        console.warn("chat list search failed with: ", err);
        return [];
    }
}
