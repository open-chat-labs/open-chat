import type { BotMatch, UserSummary } from "@shared";

// The chat list's search on OpenChat, for what isn't in the list: people and bots that take direct
// chats (web plan 04 has chats, people and messages: no groups). Every tree's chat list search runs
// it (the client's searchChatList); the old trees look up public groups beside it themselves.

/** How many of each the search asks for. */
export const CHAT_LIST_SEARCH_MAX = 10;

/** What a chat list search found, in the backend's order. */
export type ChatListSearchResults = {
    users: UserSummary[];
    bots: BotMatch[];
};

/** The backend calls a search makes. Each may fail: that one finds nothing. */
export type ChatListSearchCalls = {
    users: (term: string) => Promise<UserSummary[]>;
    bots: (term: string) => Promise<BotMatch[]>;
};

export function noChatListSearchResults(): ChatListSearchResults {
    return { users: [], bots: [] };
}

/** What a search found as one list, as the old trees' chat list search shows it: people, then bots. */
export function chatListSearchMatches(results: ChatListSearchResults): (UserSummary | BotMatch)[] {
    return [...results.users, ...results.bots];
}

/**
 * The people and bots found for a search term (one with any leading "@" dropped), both asked for
 * at once. An empty term asks the backend nothing and finds nothing.
 */
export async function runChatListSearch(
    term: string,
    calls: ChatListSearchCalls,
): Promise<ChatListSearchResults> {
    if (term === "") return noChatListSearchResults();
    const [users, bots] = await Promise.all([
        orNothing(calls.users(term)),
        orNothing(calls.bots(term)),
    ]);
    return { users, bots };
}

async function orNothing<T>(found: Promise<T[]>): Promise<T[]> {
    try {
        return await found;
    } catch (err) {
        console.warn("chat list search failed with: ", err);
        return [];
    }
}
