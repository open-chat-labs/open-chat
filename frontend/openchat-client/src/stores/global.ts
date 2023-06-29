/* eslint-disable no-case-declarations */
import {
    ChannelSummary,
    ChatIdentifier,
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
} from "openchat-shared";
import { immutableStore } from "./immutable";
import { derived } from "svelte/store";

// This will contain all state.
type GlobalState = {
    communities: CommunityMap<CommunitySummary>;
    directChats: ChatMap<DirectChatSummary>;
    groupChats: ChatMap<GroupChatSummary>;
    favourites: ObjectSet<ChatIdentifier>;
};

/**
 * This is the root of the
 */
export const globalStateStore = immutableStore<GlobalState>({
    communities: new CommunityMap<CommunitySummary>(),
    directChats: new ChatMap<DirectChatSummary>(),
    groupChats: new ChatMap<GroupChatSummary>(),
    favourites: new ObjectSet<ChatIdentifier>(),
});

export const favouritesStore = derived(globalStateStore, (state) => state.favourites);

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
    favourites: ChatIdentifier[]
): void {
    const [channels, directChats, groupChats] = partitionChats(allChats);

    const state = {
        communities: CommunityMap.fromList(communities),
        directChats: ChatMap.fromList(directChats),
        groupChats: ChatMap.fromList(groupChats),
        favourites: ObjectSet.fromList(favourites),
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
