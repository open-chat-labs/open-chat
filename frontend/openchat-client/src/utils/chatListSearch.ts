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

/**
 * A chat list search under way: each kind of result arrives on its own, so a slow or failed call
 * (the group index's, say) holds back none of the others. None rejects: a failed call finds
 * nothing.
 */
export type ChatListSearch = {
    [K in keyof ChatListSearchResults]: Promise<ChatListSearchResults[K]>;
};

/** What a search found as one list, as the old trees' chat list search shows it: people, then bots. */
export function chatListSearchMatches(
    results: Pick<ChatListSearchResults, "users" | "bots">,
): (UserSummary | BotMatch)[] {
    return [...results.users, ...results.bots];
}

/**
 * The search for a term (one with any leading "@" dropped): the people, the bots and (with a
 * `groups` call) the public groups, all asked for at once, each arriving on its own. An empty term
 * asks the backend nothing and finds nothing.
 */
export function runChatListSearch(term: string, calls: ChatListSearchCalls): ChatListSearch {
    const ask = <T>(call: ((term: string) => Promise<T[]>) | undefined): Promise<T[]> =>
        term === "" || call === undefined ? Promise.resolve([]) : orNothing(call(term));
    return { users: ask(calls.users), bots: ask(calls.bots), groups: ask(calls.groups) };
}

/**
 * Everything a search found, once every kind has arrived. `soFar` hears what has arrived each time
 * a kind does (the kinds still on their way find nothing yet), so the people can show before the
 * groups.
 */
export async function chatListSearchResults(
    search: ChatListSearch,
    soFar?: (found: ChatListSearchResults) => void,
): Promise<ChatListSearchResults> {
    let found = noChatListSearchResults();
    const arrived = (part: Partial<ChatListSearchResults>) => {
        found = { ...found, ...part };
        soFar?.(found);
    };
    await Promise.all([
        search.users.then((users) => arrived({ users })),
        search.bots.then((bots) => arrived({ bots })),
        search.groups.then((groups) => arrived({ groups })),
    ]);
    return found;
}

async function orNothing<T>(found: Promise<T[]>): Promise<T[]> {
    try {
        return await found;
    } catch (err) {
        console.warn("chat list search failed with: ", err);
        return [];
    }
}
