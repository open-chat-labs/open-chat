import type {
    CommunityCanisterCommunitySummaryUpdates,
    UserCanisterCommunitySummaryUpdates,
    CommunitySummary,
    CommunitySummaryResponse,
    UserCanisterCommunitySummary,
    ChannelSummary,
    UserCanisterChannelSummaryUpdates,
    CommunityCanisterChannelSummaryUpdates,
    ThreadSyncDetails,
    GroupCanisterThreadDetails,
    UserCanisterChannelSummary,
    UserGroupSummary,
} from "openchat-shared";
import {
    CommunityMap,
    ChatMap,
    mapOptionUpdate,
    applyOptionUpdate,
    bigIntMax,
} from "openchat-shared";
import { toRecord } from "./list";

export function mergeCommunities(
    userCanisterCommunities: UserCanisterCommunitySummary[],
    communityCanisterCommunities: CommunitySummary[],
): CommunitySummary[] {
    const userCanisterCommunityLookup = CommunityMap.fromList(userCanisterCommunities);

    return communityCanisterCommunities.map((community) => {
        const u = userCanisterCommunityLookup.get(community.id);

        return {
            ...community,
            membership: {
                ...community.membership,
                archived: u?.archived ?? community.membership.archived,
                pinned: u?.pinned ?? community.membership.pinned,
                index: u?.index ?? community.membership.index,
            },
            channels: mergeChannels(u?.channels ?? [], community.channels),
        };
    });
}

export function mergeChannels(
    userCanisterChannels: UserCanisterChannelSummary[],
    communityCanisterChannels: ChannelSummary[],
): ChannelSummary[] {
    const userCanisterGroupLookup = ChatMap.fromList(userCanisterChannels);

    return communityCanisterChannels.map((c) => {
        const u = userCanisterGroupLookup.get(c.id);

        return {
            ...c,
            dateReadPinned: u?.dateReadPinned,
            membership: {
                ...c.membership,
                latestThreads: mergeThreads(
                    [],
                    c.membership.latestThreads,
                    [],
                    u?.threadsRead ?? {},
                ),
                readByMeUpTo: u?.readByMeUpTo,
                archived: u?.archived ?? false,
            },
        };
    });
}

export function mergeCommunityUpdates(
    communities: CommunitySummary[],
    userCanisterUpdates: UserCanisterCommunitySummaryUpdates[],
    communityCanisterUpdates: CommunityCanisterCommunitySummaryUpdates[],
): CommunitySummary[] {
    const userLookup = CommunityMap.fromList(userCanisterUpdates);
    const communityLookup = CommunityMap.fromList(communityCanisterUpdates);

    return communities.map((community) => {
        const u = userLookup.get(community.id);
        const c = communityLookup.get(community.id);

        const avatarUpdate = mapOptionUpdate(c?.avatarId, (avatarId) => ({
            blobId: avatarId,
            canisterId: community.id.communityId,
        }));

        const bannerUpdate = mapOptionUpdate(c?.bannerId, (bannerId) => ({
            blobId: bannerId,
            canisterId: community.id.communityId,
        }));

        const channelsRemoved = new Set((c?.channelsRemoved ?? []).map((c) => c.channelId));

        const channelsAdded = c?.channelsAdded ?? [];

        const currentChannels = community.channels
            .filter((c) => !channelsRemoved.has(c.id.channelId))
            .concat(channelsAdded);

        return {
            kind: community.kind,
            id: community.id,
            name: c?.name ?? community?.name,
            latestEventIndex: c?.latestEventIndex ?? community.latestEventIndex,
            lastUpdated: c?.lastUpdated ?? community.lastUpdated,
            description: c?.description ?? community.description,
            memberCount: c?.memberCount ?? community.memberCount,
            metrics: c?.metrics ?? community.metrics,
            avatar: {
                ...community.avatar,
                blobReference: applyOptionUpdate(community.avatar.blobReference, avatarUpdate),
            },
            banner: {
                ...community.banner,
                blobReference: applyOptionUpdate(community.banner.blobReference, bannerUpdate),
            },
            membership: {
                ...community.membership,
                role: c?.membership?.role ?? community.membership.role,
                archived: u?.archived ?? community.membership.archived,
                pinned: u?.pinned ?? community.membership.pinned,
                index: u?.index ?? community.membership.index,
                displayName: applyOptionUpdate(
                    community.membership.displayName,
                    c?.membership?.displayName,
                ),
                rulesAccepted: c?.membership?.rulesAccepted ?? community.membership.rulesAccepted,
                lapsed: c?.membership?.lapsed ?? community.membership.lapsed,
            },
            channels: mergeChannelUpdates(
                currentChannels,
                u?.channels ?? [],
                c?.channelsUpdated ?? [],
            ),
            gateConfig: applyOptionUpdate(community.gateConfig, c?.gateConfig) ?? {
                gate: { kind: "no_gate" },
                expiry: undefined,
            },
            level: "community",
            public: c?.public ?? community.public,
            frozen: applyOptionUpdate(community.frozen, c?.frozen) ?? false,
            historyVisible: community.historyVisible,
            permissions: c?.permissions ?? community.permissions,
            primaryLanguage: c?.primaryLanguage ?? community.primaryLanguage,
            userGroups: mergeUserGroups(
                community.userGroups,
                c?.userGroups ?? [],
                c?.userGroupsDeleted ?? new Set(),
            ),
            localUserIndex: community.localUserIndex,
            isInvited: false,
        };
    });
}

function mergeUserGroups(
    existing: Map<number, UserGroupSummary>,
    updated: UserGroupSummary[],
    deleted: Set<number>,
): Map<number, UserGroupSummary> {
    deleted.forEach((id) => existing.delete(id));
    updated.forEach((g) => existing.set(g.id, g));
    return new Map(existing);
}

function mergeChannelUpdates(
    channels: ChannelSummary[],
    userCanisterUpdates: UserCanisterChannelSummaryUpdates[],
    communityCanisterUpdates: CommunityCanisterChannelSummaryUpdates[],
): ChannelSummary[] {
    const userLookup = ChatMap.fromList(userCanisterUpdates);
    const channelLookup = ChatMap.fromList(communityCanisterUpdates);

    return channels.map((channel) => {
        const u = userLookup.get(channel.id);
        const c = channelLookup.get(channel.id);

        if (u === undefined && c === undefined) return channel;

        const latestMessage = c?.latestMessage ?? channel.latestMessage;
        const readByMeUpTo = u?.readByMeUpTo ?? channel.membership.readByMeUpTo;

        const blobReferenceUpdate = mapOptionUpdate(c?.avatarId, (avatarId) => ({
            blobId: avatarId,
            canisterId: channel.id.communityId,
        }));

        const description = c?.description ?? channel.description;

        return {
            kind: "channel",
            id: channel.id,
            name: c?.name ?? channel.name,
            description,
            minVisibleEventIndex: channel.minVisibleEventIndex,
            minVisibleMessageIndex: channel.minVisibleMessageIndex,
            lastUpdated: c?.lastUpdated ?? channel.lastUpdated,
            memberCount: c?.memberCount ?? channel.memberCount,
            public: c?.public ?? channel.public,
            permissions: c?.permissions ?? channel.permissions,
            historyVisible: channel.historyVisible,
            subtype: applyOptionUpdate(channel.subtype, c?.subtype),
            previewed: false,
            frozen: channel.frozen, // frozen doesn't exist on CommunityCanisterChannelSummaryUpdates
            latestEventIndex: c?.latestEventIndex ?? channel.latestEventIndex,
            latestMessageIndex: c?.latestMessageIndex ?? channel.latestMessageIndex,
            latestMessage,
            metrics: c?.metrics ?? channel.metrics,
            blobReference: applyOptionUpdate(channel.blobReference, blobReferenceUpdate),
            dateLastPinned: c?.dateLastPinned ?? channel.dateLastPinned,
            dateReadPinned: u?.dateReadPinned ?? channel.dateReadPinned,
            gateConfig: applyOptionUpdate(channel.gateConfig, c?.gateConfig) ?? {
                gate: { kind: "no_gate" },
                expiry: undefined,
            },
            level: "channel",
            eventsTTL: applyOptionUpdate(channel.eventsTTL, c?.eventsTTL),
            eventsTtlLastUpdated: bigIntMax(
                channel.eventsTtlLastUpdated,
                c?.eventsTtlLastUpdated ?? BigInt(0),
            ),
            videoCallInProgress: applyOptionUpdate(
                channel.videoCallInProgress,
                c?.videoCallInProgress,
            ),
            membership: {
                ...channel.membership,
                mentions:
                    c === undefined
                        ? channel.membership.mentions
                        : [...(c.membership?.mentions ?? []), ...channel.membership.mentions],
                role: c?.membership?.role ?? channel.membership.role,
                latestThreads: mergeThreads(
                    channel.membership.latestThreads,
                    c?.membership?.latestThreads ?? [],
                    c?.membership?.unfollowedThreads ?? [],
                    u?.threadsRead ?? {},
                ),
                readByMeUpTo:
                    readByMeUpTo !== undefined && latestMessage !== undefined
                        ? Math.min(readByMeUpTo, latestMessage.event.messageIndex)
                        : readByMeUpTo,
                notificationsMuted:
                    c?.membership?.notificationsMuted ?? channel.membership.notificationsMuted,
                myMetrics: c?.membership?.myMetrics ?? channel.membership.myMetrics,
                archived: u?.archived ?? channel.membership.archived,
                rulesAccepted: c?.membership?.rulesAccepted ?? channel.membership.rulesAccepted,
                lapsed: c?.membership?.lapsed ?? channel.membership.lapsed,
            },
            isInvited: false,
            messagesVisibleToNonMembers:
                c?.messageVisibleToNonMembers ?? channel.messagesVisibleToNonMembers,
            externalUrl: applyOptionUpdate(channel.externalUrl, c?.externalUrl),
        };
    });
}

function mergeThreads(
    current: ThreadSyncDetails[],
    communityCanisterUpdates: GroupCanisterThreadDetails[],
    unfollowedThreads: number[],
    readUpToUpdates: Record<number, number>,
): ThreadSyncDetails[] {
    const initial = current.filter((t) => !unfollowedThreads.includes(t.threadRootMessageIndex));
    const threadsRecord = toRecord(initial, (t) => t.threadRootMessageIndex);

    for (const groupUpdate of communityCanisterUpdates) {
        threadsRecord[groupUpdate.threadRootMessageIndex] = {
            ...threadsRecord[groupUpdate.threadRootMessageIndex],
            ...groupUpdate,
        };
    }

    return Object.values(threadsRecord).map((t) => {
        const readUpToUpdate = readUpToUpdates[t.threadRootMessageIndex];
        return readUpToUpdate !== undefined && readUpToUpdate > (t.readUpTo ?? -1)
            ? { ...t, readUpTo: readUpToUpdate }
            : t;
    });
}

export function isSuccessfulCommunitySummaryResponse(
    response: CommunitySummaryResponse,
): response is CommunitySummary {
    return "id" in response;
}
