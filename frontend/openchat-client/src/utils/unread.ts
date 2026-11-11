import {
    emptyCombinedUnreadCounts,
    type ChatListScope,
    type ChatSummary,
    type CombinedUnreadCounts,
    type CommunityIdentifier,
    type ReadonlyMap,
    type UnreadCounts,
} from "@shared";

// What the chat lists count as unread: a chat row's unread mentions, a scope's unread chats and
// threads, and which of a count's numbers to show. Every tree's chat list uses these.

/** Whether a mention's message has been read (`isMessageRead` in the chat's own context). */
export type MentionRead = (messageIndex: number, messageId: bigint) => boolean;

/**
 * A chat's unread mentions: none in a DM, else the mentions of the user its member summary holds
 * that `isRead` says are still unread. It follows `messagesRead` as `isRead` does, so a caller that
 * needs it to update as messages are read reads that store too.
 */
export function unreadMentionCount(chat: ChatSummary, isRead: MentionRead): number {
    if (chat.kind === "direct_chat") return 0;
    return chat.membership.mentions.filter((m) => !isRead(m.messageIndex, m.messageId)).length;
}

/** The unread counts of every scope (the stores of the same names). */
export type ScopeUnreadCountsInput = {
    /** unreadDirectAndGroupCountsStore */
    directAndGroup: CombinedUnreadCounts;
    /** unreadFavouriteCountsStore */
    favourite: CombinedUnreadCounts;
    /** unreadCommunityChannelCountsStore */
    communityChannels: ReadonlyMap<CommunityIdentifier, CombinedUnreadCounts>;
};

/**
 * A chat list scope's unread counts, its chats' and its threads': the DMs and groups', the
 * favourites', or a community's channels' (none for a community with no counts, and for "none").
 */
export function scopeUnreadCounts(
    scope: ChatListScope,
    counts: ScopeUnreadCountsInput,
): CombinedUnreadCounts {
    switch (scope.kind) {
        case "chats":
            return counts.directAndGroup;
        case "favourite":
            return counts.favourite;
        case "community":
            return counts.communityChannels.get(scope.id) ?? emptyCombinedUnreadCounts();
        default:
            return emptyCombinedUnreadCounts();
    }
}

/** The number an unread count shows, and whether it shows as muted. */
export type UnreadCountShown = { count: number; muted: boolean };

/**
 * Which of an unread count's numbers to show: the unmuted one, unless that's 0 with no mentions,
 * then the muted one, shown as muted.
 */
export function unreadCountShown(unread: UnreadCounts): UnreadCountShown {
    const muted = !unread.mentions && unread.unmuted <= 0;
    return { count: muted ? unread.muted : unread.unmuted, muted };
}
