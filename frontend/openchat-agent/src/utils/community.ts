import {
    CommunityCanisterCommunitySummaryUpdates,
    CommunityMap,
    UserCanisterCommunitySummaryUpdates,
    type CommunitySummary,
    type CommunitySummaryResponse,
    type UserCanisterCommunitySummary,
    CommunitySummaryUpdatesResponse,
    ChannelSummary,
    UserCanisterChannelSummaryUpdates,
    CommunityCanisterChannelSummaryUpdates,
    ChatMap,
    ThreadSyncDetails,
    GroupCanisterThreadDetails,
} from "openchat-shared";
import { applyOptionUpdate, mapOptionUpdate } from "./mapping";
import { toRecord } from "./list";

export function mergeCommunities(
    _userCanisterCommunities: UserCanisterCommunitySummary[],
    communityCanisterCommunities: CommunitySummary[]
): CommunitySummary[] {
    // const userCanisterCommunityLookup = CommunityMap.fromList(userCanisterCommunities);

    return communityCanisterCommunities.map((community) => {
        // const _u = userCanisterCommunityLookup.get(community.id);

        return {
            ...community,
        };
    });
}

export function mergeCommunityUpdates(
    communities: CommunitySummary[],
    userCanisterUpdates: UserCanisterCommunitySummaryUpdates[],
    communityCanisterUpdates: CommunityCanisterCommunitySummaryUpdates[]
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

        const channelsRemoved = new Set(
            (c?.membership?.channelsRemoved ?? []).map((c) => c.channelId)
        );

        const channelsAdded = c?.channelsAdded ?? [];

        const currentChannels = community.channels
            .filter((c) => !channelsRemoved.has(c.id.channelId))
            .concat(channelsAdded);

        return {
            id: community.id,
            name: c?.name ?? community?.name,
            latestEventIndex: c?.latestEventIndex ?? community.latestEventIndex,
            lastUpdated: c?.lastUpdated ?? community.lastUpdated,
            description: c?.description ?? community.description,
            memberCount: c?.memberCount ?? community.memberCount,
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
                archived: u?.archived ?? community.membership.archived, // TODO - community membership has no archived property
                pinned: u?.pinned ?? community.membership.pinned,
            },
            channels: mergeChannelUpdates(
                currentChannels,
                u?.channels ?? [],
                c?.channelsUpdated ?? []
            ),
            gate: applyOptionUpdate(community.gate, c?.gate) ?? { kind: "no_gate" },
            level: "community",
            public: c?.public ?? community.public,
            frozen: applyOptionUpdate(community.frozen, c?.frozen) ?? false,
            historyVisible: community.historyVisible,
            permissions: c?.permissions ?? community.permissions,
        };
    });
}

export function mergeChannelUpdates(
    channels: ChannelSummary[],
    userCanisterUpdates: UserCanisterChannelSummaryUpdates[],
    communityCanisterUpdates: CommunityCanisterChannelSummaryUpdates[]
): ChannelSummary[] {
    const userLookup = ChatMap.fromList(userCanisterUpdates);
    const communityLookup = ChatMap.fromList(communityCanisterUpdates);

    return channels.map((channel) => {
        const u = userLookup.get(channel.id);
        const c = communityLookup.get(channel.id);

        if (u === undefined && c === undefined) return channel;

        const latestMessage = c?.latestMessage ?? channel.latestMessage;
        const readByMeUpTo = u?.readByMeUpTo ?? channel.membership.readByMeUpTo;

        const blobReferenceUpdate = mapOptionUpdate(c?.avatarId, (avatarId) => ({
            blobId: avatarId,
            canisterId: channel.id.communityId,
        }));

        return {
            kind: "channel",
            id: channel.id,
            name: c?.name ?? channel.name,
            description: c?.description ?? channel.description,
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
            latestMessage,
            metrics: c?.metrics ?? channel.metrics,
            blobReference: applyOptionUpdate(channel.blobReference, blobReferenceUpdate),
            dateLastPinned: c?.dateLastPinned ?? channel.dateLastPinned,
            dateReadPinned: u?.dateReadPinned ?? channel.dateReadPinned,
            gate: applyOptionUpdate(channel.gate, c?.gate) ?? { kind: "no_gate" },
            level: "group",
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
                    u?.threadsRead ?? {}
                ),
                readByMeUpTo:
                    readByMeUpTo !== undefined && latestMessage !== undefined
                        ? Math.min(readByMeUpTo, latestMessage.event.messageIndex)
                        : readByMeUpTo,
                notificationsMuted:
                    c?.membership?.notificationsMuted ?? channel.membership.notificationsMuted,
                myMetrics: c?.membership?.myMetrics ?? channel.membership.myMetrics,
                archived: u?.archived ?? channel.membership.archived,
            },
        };
    });
}

function mergeThreads(
    current: ThreadSyncDetails[],
    groupCanisterUpdates: GroupCanisterThreadDetails[],
    readUpToUpdates: Record<number, number>
): ThreadSyncDetails[] {
    const threadsRecord = toRecord(current, (t) => t.threadRootMessageIndex);

    for (const groupUpdate of groupCanisterUpdates) {
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
    response: CommunitySummaryResponse
): response is CommunitySummary {
    console.log("xxx: community response", response);
    return "id" in response;
}

export function isSuccessfulCommunitySummaryUpdatesResponse(
    response: CommunitySummaryUpdatesResponse
): response is CommunityCanisterCommunitySummaryUpdates {
    return "id" in response;
}
