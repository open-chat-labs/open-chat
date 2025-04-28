/* eslint-disable no-case-declarations */
import type {
    ChannelSummary,
    ChatIdentifier,
    ChatListScope,
    ChatSummary,
    ChitState,
    CommunityIdentifier,
    CommunitySummary,
    DirectChatSummary,
    ExternalBotPermissions,
    GroupChatSummary,
    MessageActivitySummary,
    PublicApiKeyDetails,
    Referral,
    StreakInsurance,
    VideoCallCounts,
    WalletConfig,
} from "openchat-shared";
import {
    ChatMap,
    CommunityMap,
    ObjectSet,
    SafeMap,
    chatScopesEqual,
    videoCallsInProgressForChats,
} from "openchat-shared";
import { derived } from "svelte/store";
import { app } from "../state/app.svelte";
import { immutableStore } from "./immutable";
import { messageActivityFeedReadUpToLocally, messagesRead } from "./markRead";
import { safeWritable } from "./safeWritable";
import { serverStreakInsuranceStore } from "./streakInsurance";

export type PinnedByScope = Map<ChatListScope["kind"], ChatIdentifier[]>;

// This will contain all state.
export type GlobalState = {
    communities: CommunityMap<CommunitySummary>;
    directChats: ChatMap<DirectChatSummary>;
    groupChats: ChatMap<GroupChatSummary>;
    favourites: ObjectSet<ChatIdentifier>;
    achievements: Set<string>;
    referrals: Referral[];
    messageActivitySummary: MessageActivitySummary;
};

export const chitStateStore = immutableStore<ChitState>({
    chitBalance: 0,
    totalChitEarned: 0,
    streak: 0,
    streakEnds: 0n,
    nextDailyChitClaim: 0n,
});

export const globalStateStore = immutableStore<GlobalState>({
    communities: new CommunityMap<CommunitySummary>(),
    directChats: new ChatMap<DirectChatSummary>(),
    groupChats: new ChatMap<GroupChatSummary>(),
    favourites: new ObjectSet<ChatIdentifier>(),
    achievements: new Set(),
    referrals: [],
    messageActivitySummary: {
        readUpToTimestamp: 0n,
        latestTimestamp: 0n,
        unreadCount: 0,
    },
});

// This should always be referenced via app.chatListScope where possible - this store only exists for backward compatibility and will be removed
export const chatListScopeStore = safeWritable<ChatListScope>({ kind: "none" }, chatScopesEqual);

export type CombinedUnreadCounts = {
    threads: UnreadCounts;
    chats: UnreadCounts;
};

export type UnreadCounts = {
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

export function emptyCombinedUnreadCounts(): CombinedUnreadCounts {
    return {
        chats: emptyUnreadCounts(),
        threads: emptyUnreadCounts(),
    };
}

function hasUnreadMentions(chat: ChatSummary): boolean {
    if (chat.kind === "direct_chat") return false;
    return (
        chat.membership.mentions.filter(
            (m) => !messagesRead.isRead({ chatId: chat.id }, m.messageIndex, m.messageId),
        ).length > 0
    );
}

function mergeUnreadCounts(
    unreadMessages: number,
    muted: boolean,
    mentions: boolean,
    counts: UnreadCounts,
    increment: number = 1,
): UnreadCounts {
    const toAdd = unreadMessages > 0 ? increment : 0;
    return {
        mentions: counts.mentions || mentions,
        unmuted: muted ? counts.unmuted : counts.unmuted + toAdd,
        muted: muted ? counts.muted + toAdd : counts.muted,
    };
}

function combinedUnreadCountForChats(chats: (ChatSummary | undefined)[]): CombinedUnreadCounts {
    return chats.reduce(
        (counts, chat) => {
            if (chat === undefined) return counts;

            const muted = chat.membership.notificationsMuted;
            const unreadMessages = messagesRead.unreadMessageCount(
                chat.id,
                chat.latestMessage?.event.messageIndex,
            );
            const mentions = unreadMessages > 0 && hasUnreadMentions(chat);
            const unreadThreads = messagesRead.staleThreadCountForChat(
                chat.id,
                chat.membership.latestThreads,
            );
            return {
                chats: mergeUnreadCounts(unreadMessages, muted, mentions, counts.chats),
                threads: mergeUnreadCounts(
                    unreadThreads,
                    muted,
                    false,
                    counts.threads,
                    unreadThreads,
                ),
            };
        },
        { chats: emptyUnreadCounts(), threads: emptyUnreadCounts() } as CombinedUnreadCounts,
    );
}

export function mergeCombinedUnreadCounts({ chats, threads }: CombinedUnreadCounts): UnreadCounts {
    return mergePairOfUnreadCounts(chats, threads);
}

export function mergeListOfCombinedUnreadCounts(
    counts: CombinedUnreadCounts[],
): CombinedUnreadCounts {
    return counts.reduce(
        (result, count) => mergePairOfCombinedUnreadCounts(result, count),
        emptyCombinedUnreadCounts(),
    );
}

export function mergePairOfCombinedUnreadCounts(
    a: CombinedUnreadCounts,
    b: CombinedUnreadCounts,
): CombinedUnreadCounts {
    return {
        chats: mergePairOfUnreadCounts(a.chats, b.chats),
        threads: mergePairOfUnreadCounts(a.threads, b.threads),
    };
}

export function mergePairOfUnreadCounts(a: UnreadCounts, b: UnreadCounts): UnreadCounts {
    return {
        muted: a.muted + b.muted,
        unmuted: a.unmuted + b.unmuted,
        mentions: a.mentions || b.mentions,
    };
}

// the messagesRead store is used as part of the derivation so that it gets recomputed when messages are read
export const unreadGroupCounts = derived(
    [globalStateStore, messagesRead],
    ([$global, _$messagesRead]) => {
        return combinedUnreadCountForChats(Array.from($global.groupChats.values()));
    },
);

export const groupVideoCallCounts = derived([globalStateStore], ([$global]) => {
    return videoCallsInProgressForChats(Array.from($global.groupChats.values()));
});

export const unreadDirectCounts = derived(
    [globalStateStore, messagesRead],
    ([$global, _$messagesRead]) => {
        return combinedUnreadCountForChats(Array.from($global.directChats.values()));
    },
);

export const unreadActivityCount = derived(
    [globalStateStore, messageActivityFeedReadUpToLocally],
    ([$global, readUpToLocally]) => {
        if (
            readUpToLocally !== undefined &&
            readUpToLocally >= $global.messageActivitySummary.latestTimestamp
        ) {
            return 0;
        }
        return $global.messageActivitySummary.unreadCount;
    },
);

export const directVideoCallCounts = derived([globalStateStore], ([$global]) => {
    return videoCallsInProgressForChats(Array.from($global.directChats.values()));
});

export function getAllServerChats(global: GlobalState): ChatMap<ChatSummary> {
    const groupChats = global.groupChats.values();
    const directChats = global.directChats.values();
    const channels = [...global.communities.values()].flatMap((c) => c.channels);
    return ChatMap.fromList([...groupChats, ...directChats, ...channels]);
}

export const allServerChats = derived(globalStateStore, ($global) => {
    return getAllServerChats($global);
});

export const unreadFavouriteCounts = derived(
    [globalStateStore, messagesRead],
    ([$global, _$messagesRead]) => {
        const allChats = getAllServerChats($global);
        const chats = $global.favourites.values().map((id) => allChats.get(id));
        return combinedUnreadCountForChats(chats);
    },
);

export const favouritesVideoCallCounts = derived([globalStateStore], ([$global]) => {
    const allChats = getAllServerChats($global);
    const chats = $global.favourites.values().map((id) => allChats.get(id));
    return videoCallsInProgressForChats(chats);
});

export const communityChannelVideoCallCounts = derived([globalStateStore], ([$global]) => {
    return [...$global.communities.values()].reduce((map, community) => {
        map.set(community.id, videoCallsInProgressForChats(community.channels));
        return map;
    }, new CommunityMap<VideoCallCounts>());
});

export const unreadCommunityChannelCounts = derived(
    [globalStateStore, messagesRead],
    ([$global, _$messagesRead]) => {
        return [...$global.communities.values()].reduce((map, community) => {
            map.set(community.id, combinedUnreadCountForChats(community.channels));
            return map;
        }, new CommunityMap<CombinedUnreadCounts>());
    },
);

export const globalUnreadCount = derived(
    [unreadGroupCounts, unreadDirectCounts, unreadCommunityChannelCounts],
    ([$groupCounts, $directCounts, $communities]) => {
        return mergeListOfCombinedUnreadCounts([
            $groupCounts,
            $directCounts,
            mergeListOfCombinedUnreadCounts(Array.from($communities.values())),
        ]);
    },
);

export function setGlobalState(
    communities: CommunitySummary[],
    allChats: ChatSummary[],
    favourites: ChatIdentifier[],
    pinnedChats: PinnedByScope,
    achievements: Set<string>,
    chitState: ChitState,
    referrals: Referral[],
    walletConfig: WalletConfig,
    messageActivitySummary: MessageActivitySummary,
    installedBots: Map<string, ExternalBotPermissions>,
    apiKeys: Map<string, PublicApiKeyDetails>,
    streakInsurance: StreakInsurance | undefined,
): void {
    const [channels, directChats, groupChats] = partitionChats(allChats);

    const communitiesMap = CommunityMap.fromList(communities);
    const state = {
        communities: communitiesMap,
        directChats: ChatMap.fromList(directChats),
        groupChats: ChatMap.fromList(groupChats),
        favourites: ObjectSet.fromList(favourites),
        achievements,
        referrals,
        messageActivitySummary,
    };
    Object.entries(channels).forEach(([communityId, channels]) => {
        const id: CommunityIdentifier = { kind: "community", communityId };
        const community = communitiesMap.get(id);
        if (community !== undefined) {
            communitiesMap.set(id, {
                ...community,
                channels,
            });
        }
    });

    app.serverCommunities = communitiesMap;
    app.serverPinnedChats = pinnedChats;
    app.directChatApiKeys = apiKeys;
    app.directChatBots = SafeMap.fromEntries(installedBots.entries());
    app.serverWalletConfig = walletConfig;

    globalStateStore.set(state);
    chitStateStore.update((curr) => {
        // Skip the new update if it is behind what we already have locally
        const skipUpdate = chitState.streakEnds < curr.streakEnds;
        return skipUpdate ? curr : chitState;
    });
    if (streakInsurance !== undefined) {
        serverStreakInsuranceStore.set(streakInsurance);
    }
}

function partitionChats(
    allChats: ChatSummary[],
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
        [[], [], []] as [ChannelSummary[], DirectChatSummary[], GroupChatSummary[]],
    );
    return [channelsByCommunityId(channels), direct, group];
}

function channelsByCommunityId(chats: ChannelSummary[]): Record<string, ChannelSummary[]> {
    return chats.reduce(
        (acc, chat) => {
            const communityId = chat.id.communityId;
            const channels = acc[communityId] ?? [];
            channels.push(chat);
            return {
                ...acc,
                [communityId]: channels,
            };
        },
        {} as Record<string, ChannelSummary[]>,
    );
}
