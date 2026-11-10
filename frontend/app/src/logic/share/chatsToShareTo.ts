import {
    shareTargets,
    type ChatIdentifier,
    type ChatSummary,
    type CommunitySummary,
    type DirectChatSummary,
    type GroupChatSummary,
    type OpenChat,
    type ShareableChat,
    type ShareableCommunity,
    type ShareTarget,
    type ShareTargets,
    type UserLookup,
} from "@client";
import { buildDisplayName } from "@src/utils/user";

/** The stores' values a chat picker lists from: each tree passes them in as it reads them. */
export type ShareSources = {
    directChats: Iterable<DirectChatSummary>;
    groupChats: Iterable<GroupChatSummary>;
    communities: Iterable<CommunitySummary>;
    favourites: { has(id: ChatIdentifier): boolean };
    users: UserLookup;
};

/**
 * The user's chats something can be shared to (@client shareTargets), for every tree's picker:
 * a DM goes by its other user's display name and "@username", and only chats the user can send
 * text in are offered. `leaveOut` is a chat not to offer (the open one, when sharing from it).
 */
export function chatsToShareTo(
    client: Pick<OpenChat, "canSendMessage">,
    sources: ShareSources,
    leaveOut: ChatIdentifier | undefined,
    search: string,
): ShareTargets {
    return shareTargets<ChatSummary, CommunitySummary>({
        directChats: [...sources.directChats],
        groupChats: [...sources.groupChats],
        communities: [...sources.communities],
        isFavourite: (id) => sources.favourites.has(id),
        directChatName: (userId) => ({
            // plain text: every picker shows (and sorts and searches) it as it is
            name: buildDisplayName(sources.users, userId, "user", false),
            username: sources.users.get(userId)?.username,
        }),
        canSendText: (id) => client.canSendMessage(id, "message", "text"),
        selectedChatId: leaveOut,
        excludeCurrent: leaveOut !== undefined,
        search,
    });
}

/** The headers of the sections a picker lists the chats in, in the app's words. */
export type ShareSectionNames = { favourites: string; directChats: string; groupChats: string };

/**
 * The chats in the sections every picker lists them in, each with its section's header:
 * favourites, direct chats, groups, then each community's channels under its name (a favourite
 * is listed in its own section too).
 */
export function shareTargetsInSections<C extends ShareableChat, M extends ShareableCommunity<C>>(
    targets: ShareTargets<C, M>,
    sections: ShareSectionNames,
): { target: ShareTarget<C>; section: string }[] {
    const under = (section: string) => (target: ShareTarget<C>) => ({ target, section });
    return [
        ...targets.favourites.map(under(sections.favourites)),
        ...targets.directChats.map(under(sections.directChats)),
        ...targets.groupChats.map(under(sections.groupChats)),
        ...targets.communities.flatMap((c) => c.channels.map(under(c.community.name))),
    ];
}
