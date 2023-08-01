/* eslint-disable no-case-declarations */
import {
    ChannelSummary,
    ChatIdentifier,
    ChatListScope,
    ChatMap,
    ChatSummary,
    CommunityIdentifier,
    CommunityMap,
    CommunitySummary,
    DirectChatSummary,
    EventWrapper,
    GroupChatSummary,
    Message,
    ObjectSet,
    chatScopesEqual,
} from "openchat-shared";
import { immutableStore } from "./immutable";
import { derived } from "svelte/store";
import { messagesRead } from "./markRead";
import { safeWritable } from "./safeWritable";

export type PinnedByScope = Record<ChatListScope["kind"], ChatIdentifier[]>;

// This will contain all state.
export type GlobalState = {
    communities: CommunityMap<CommunitySummary>;
    directChats: ChatMap<DirectChatSummary>;
    groupChats: ChatMap<GroupChatSummary>;
    favourites: ObjectSet<ChatIdentifier>;
    pinnedChats: PinnedByScope;
};

/**
 * This is the root of the
 */
export const globalStateStore = immutableStore<GlobalState>({
    communities: new CommunityMap<CommunitySummary>(),
    directChats: new ChatMap<DirectChatSummary>(),
    groupChats: new ChatMap<GroupChatSummary>(),
    favourites: new ObjectSet<ChatIdentifier>(),
    pinnedChats: {
        group_chat: [],
        direct_chat: [],
        favourite: [],
        community: [],
        none: [],
    },
});

export const pinnedChatsStore = derived(globalStateStore, ($global) => $global.pinnedChats);

export const chatListScopeStore = safeWritable<ChatListScope>({ kind: "none" }, chatScopesEqual);

export const favouritesStore = derived(globalStateStore, (state) => state.favourites);

type UnreadCounts = {
    muted: number;
    unmuted: number;
    mentions: boolean;
};

export function emptyUnreadCounts(): UnreadCounts {
    return {
        muted: 0,
        unmuted: 0,
        mentions: false,
    };
}

function hasUnreadMentions(chat: ChatSummary): boolean {
    if (chat.kind === "direct_chat") return false;
    return (
        chat.membership.mentions.filter(
            (m) => !messagesRead.isRead(chat.id, m.messageIndex, m.messageId)
        ).length > 0
    );
}

function unreadCountForChatList(chats: (ChatSummary | undefined)[]): UnreadCounts {
    return chats.reduce(
        (counts, chat) => {
            if (chat === undefined) return counts;
            const unread = messagesRead.unreadMessageCount(
                chat.id,
                chat.latestMessage?.event.messageIndex
            );
            const increment = unread > 0 ? 1 : 0;
            return {
                mentions: counts.mentions || hasUnreadMentions(chat),
                unmuted: chat.membership.notificationsMuted
                    ? counts.unmuted
                    : counts.unmuted + increment,
                muted: chat.membership.notificationsMuted ? counts.muted + increment : counts.muted,
            };
        },
        { muted: 0, unmuted: 0, mentions: false } as UnreadCounts
    );
}

// the messagesRead store is used as part of the derivation so that it gets recomputed when messages are read
export const unreadGroupChats = derived(
    [globalStateStore, messagesRead],
    ([$global, _$messagesRead]) => {
        return unreadCountForChatList($global.groupChats.values());
    }
);

export const unreadDirectChats = derived(
    [globalStateStore, messagesRead],
    ([$global, _$messagesRead]) => {
        return unreadCountForChatList($global.directChats.values());
    }
);

export function getAllChats(global: GlobalState): ChatMap<ChatSummary> {
    const groupChats = global.groupChats.values();
    const directChats = global.directChats.values();
    const channels = global.communities.values().flatMap((c) => c.channels);
    return ChatMap.fromList([...groupChats, ...directChats, ...channels]);
}

export const allChats = derived(globalStateStore, ($global) => {
    return getAllChats($global);
});

export const unreadFavouriteChats = derived(
    [globalStateStore, messagesRead],
    ([$global, _$messagesRead]) => {
        const allChats = getAllChats($global);
        const chats = $global.favourites.values().map((id) => allChats.get(id));
        return unreadCountForChatList(chats);
    }
);

export const unreadCommunityChannels = derived(
    [globalStateStore, messagesRead],
    ([$global, _$messagesRead]) => {
        return $global.communities.values().reduce((map, community) => {
            map.set(community.id, unreadCountForChatList(community.channels));
            return map;
        }, new CommunityMap<UnreadCounts>());
    }
);

export const globalUnreadCount = derived(
    [unreadGroupChats, unreadDirectChats, unreadCommunityChannels],
    ([groupCounts, directCounts, $communities]) => {
        const communityCounts = $communities.values().reduce(
            (agg, counts) => {
                return {
                    unmuted: agg.unmuted + counts.unmuted,
                    muted: agg.muted + counts.muted,
                    mentions: agg.mentions || counts.mentions,
                };
            },
            { muted: 0, unmuted: 0, mentions: false }
        );
        return {
            unmuted: groupCounts.unmuted + directCounts.unmuted + communityCounts.unmuted,
            muted: groupCounts.muted + directCounts.muted + communityCounts.muted,
            mentions: groupCounts.mentions || directCounts.mentions || communityCounts.mentions,
        };
    }
);

function updateLastMessage<T extends ChatSummary>(chat: T, message: EventWrapper<Message>): T {
    const latestEventIndex = Math.max(message.index, chat.latestEventIndex);
    const overwriteLatestMessage =
        chat.latestMessage === undefined ||
        message.index > chat.latestMessage.index ||
        // If they are the same message, take the confirmed one since it'll have the correct timestamp
        message.event.messageId === chat.latestMessage.event.messageId;

    const latestMessage = overwriteLatestMessage ? message : chat.latestMessage;

    return {
        ...chat,
        latestEventIndex,
        latestMessage,
    };
}

export function updateSummaryWithConfirmedMessage(
    chatId: ChatIdentifier,
    message: EventWrapper<Message>
): void {
    globalStateStore.update((state) => {
        switch (chatId.kind) {
            case "channel":
                const community = state.communities.get({
                    kind: "community",
                    communityId: chatId.communityId,
                });
                if (community !== undefined) {
                    state.communities.set(community.id, {
                        ...community,
                        channels: community.channels.map((c) => {
                            if (c.id.channelId === chatId.channelId) {
                                return updateLastMessage(c, message);
                            }
                            return c;
                        }),
                    });
                }
                return state;
            case "direct_chat":
                const directChat = state.directChats.get(chatId);
                if (directChat !== undefined) {
                    state.directChats.set(chatId, updateLastMessage(directChat, message));
                }
                return state;
            case "group_chat":
                const groupChat = state.groupChats.get(chatId);
                if (groupChat !== undefined) {
                    state.groupChats.set(chatId, updateLastMessage(groupChat, message));
                }
                return state;
        }
    });
}

export function setGlobalState(
    communities: CommunitySummary[],
    allChats: ChatSummary[],
    favourites: ChatIdentifier[],
    pinnedChats: PinnedByScope
): void {
    const [channels, directChats, groupChats] = partitionChats(allChats);

    const state = {
        communities: CommunityMap.fromList(communities),
        directChats: ChatMap.fromList(directChats),
        groupChats: ChatMap.fromList(groupChats),
        favourites: ObjectSet.fromList(favourites),
        pinnedChats,
    };
    Object.entries(channels).forEach(([communityId, channels]) => {
        const id: CommunityIdentifier = { kind: "community", communityId };
        const community = state.communities.get(id);
        if (community !== undefined) {
            state.communities.set(id, {
                ...community,
                channels,
            });
        }
    });

    globalStateStore.set(state);
}

function partitionChats(
    allChats: ChatSummary[]
): [Record<string, ChannelSummary[]>, DirectChatSummary[], GroupChatSummary[]] {
    const [channels, direct, group] = allChats.reduce(
        ([channels, direct, group], chat) => {
            switch (chat.kind) {
                case "channel":
                    channels.push(chat);
                    break;
                case "direct_chat":
                    direct.push(chat);
                    break;
                case "group_chat":
                    group.push(chat);
                    break;
            }
            return [channels, direct, group];
        },
        [[], [], []] as [ChannelSummary[], DirectChatSummary[], GroupChatSummary[]]
    );
    return [channelsByCommunityId(channels), direct, group];
}

function channelsByCommunityId(chats: ChannelSummary[]): Record<string, ChannelSummary[]> {
    return chats.reduce((acc, chat) => {
        const communityId = chat.id.communityId;
        const channels = acc[communityId] ?? [];
        channels.push(chat);
        return {
            ...acc,
            [communityId]: channels,
        };
    }, {} as Record<string, ChannelSummary[]>);
}
