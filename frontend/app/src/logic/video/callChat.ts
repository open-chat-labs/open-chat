import type {
    ChatIdentifier,
    ChatSummary,
    CommunitySummary,
    DirectChatIdentifier,
    OpenChat,
    UserSummary,
    VideoCallInProgress,
} from "@client";

/** The chat a call is in, as the call's views show it: its name and picture. */
export type VideoCallChat = {
    chatId: ChatIdentifier;
    name: string;
    avatarUrl: string;
    /** The other person, in a DM's call. */
    userId: DirectChatIdentifier | undefined;
    videoCallInProgress?: VideoCallInProgress;
};

/**
 * The chat a call is in, named as the call's views name it: a DM by the other person, a group by
 * its name, a channel as "Community > Channel".
 */
export function videoCallChat(
    client: Pick<OpenChat, "displayName" | "userAvatarUrl" | "groupAvatarUrl">,
    chat: ChatSummary,
    users: ReadonlyMap<string, UserSummary>,
    communities: {
        get(id: { kind: "community"; communityId: string }): CommunitySummary | undefined;
    },
): VideoCallChat {
    const common = { chatId: chat.id, videoCallInProgress: chat.videoCallInProgress };
    switch (chat.kind) {
        case "direct_chat": {
            const them = users.get(chat.them.userId);
            return {
                ...common,
                name: client.displayName(them),
                avatarUrl: client.userAvatarUrl(them),
                userId: chat.them,
            };
        }
        case "group_chat":
            return {
                ...common,
                name: chat.name,
                avatarUrl: client.groupAvatarUrl(chat),
                userId: undefined,
            };
        case "channel": {
            const community = communities.get({
                kind: "community",
                communityId: chat.id.communityId,
            });
            return {
                ...common,
                name: `${community?.name} > ${chat.name}`,
                avatarUrl: client.groupAvatarUrl(chat, community),
                userId: undefined,
            };
        }
    }
}

/** The call's chat as the call shows it: its name, and when the call started, if the chat says. */
export function callHeading(
    client: Pick<
        OpenChat,
        "lookupChatSummary" | "displayName" | "userAvatarUrl" | "groupAvatarUrl"
    >,
    chatId: ChatIdentifier,
    users: ReadonlyMap<string, UserSummary>,
    communities: {
        get(id: { kind: "community"; communityId: string }): CommunitySummary | undefined;
    },
): { title: string; started: number | undefined } | undefined {
    const chat = client.lookupChatSummary(chatId);
    if (chat === undefined) return undefined;
    return {
        title: videoCallChat(client, chat, users, communities).name,
        started:
            chat.videoCallInProgress === undefined
                ? undefined
                : Number(chat.videoCallInProgress.started),
    };
}
