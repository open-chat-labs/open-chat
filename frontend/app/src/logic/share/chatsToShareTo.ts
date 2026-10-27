import {
    shareTargets,
    type ChatIdentifier,
    type ChatSummary,
    type CommunitySummary,
    type DirectChatSummary,
    type GroupChatSummary,
    type OpenChat,
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
            name: buildDisplayName(sources.users, userId, "user"),
            username: sources.users.get(userId)?.username,
        }),
        canSendText: (id) => client.canSendMessage(id, "message", "text"),
        selectedChatId: leaveOut,
        excludeCurrent: leaveOut !== undefined,
        search,
    });
}
