import {
    ChatMap,
    chatIdentifierToString,
    getDisplayDate,
    type ChatIdentifier,
    type ChatListScope,
    type ChatSummary,
    type ReadonlyMap,
    type ReadonlySet,
} from "@shared";

// A chat list: the chats in a scope, in the order the list shows them. chatSummariesStore and
// chatSummariesListStore are these for the route's scope; a view that keeps a list for a scope of
// its own (the native Chats tab, whose root stays mounted while another tab's route sets another
// scope) calls them with that scope.

/** The chats in a scope: a community's channels, the DMs and groups, or the favourites. */
export function chatsInScope(
    scope: ChatListScope,
    allChats: ChatMap<ChatSummary>,
    favourites: ReadonlySet<ChatIdentifier>,
): ChatMap<ChatSummary> {
    switch (scope.kind) {
        case "community": {
            const communityId = scope.id.communityId;
            return allChats.filter((c) => c.kind === "channel" && c.id.communityId === communityId);
        }
        case "chats":
            return allChats.filter((c) => c.kind === "direct_chat" || c.kind === "group_chat");
        case "favourite": {
            return [...favourites].reduce((favs, chatId) => {
                const chat = allChats.get(chatId);
                if (chat !== undefined) {
                    favs.set(chat.id, chat);
                }
                return favs;
            }, new ChatMap<ChatSummary>());
        }
        default:
            return new ChatMap<ChatSummary>();
    }
}

/**
 * A scope's chats in list order: its pinned chats first, in the order they were pinned (the
 * latest first), then the others, the latest activity first.
 */
export function chatListOrder(
    pinnedByScope: readonly ChatIdentifier[],
    chats: ReadonlyMap<ChatIdentifier, ChatSummary>,
): ChatSummary[] {
    const pinned = pinnedByScope.reduce<ChatSummary[]>((result, id) => {
        const summary = chats.get(id);
        if (summary !== undefined) {
            result.push(summary);
        }
        return result;
    }, []);
    const pinnedIds = new Set(pinnedByScope.map(chatIdentifierToString));
    // compute the (bigint) display date once per chat rather than twice per comparison
    const unpinned: [bigint, ChatSummary][] = [];
    for (const chat of chats.values()) {
        if (!pinnedIds.has(chatIdentifierToString(chat.id))) {
            unpinned.push([getDisplayDate(chat), chat]);
        }
    }
    unpinned.sort(([a], [b]) => (a === b ? 0 : a < b ? 1 : -1));
    return pinned.concat(unpinned.map(([, chat]) => chat));
}
