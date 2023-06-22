import {
    CommunityCanisterCommunitySummaryUpdates,
    CommunityMap,
    UserCanisterCommunitySummaryUpdates,
    type CommunitySummary,
    type CommunitySummaryResponse,
    type UserCanisterCommunitySummary,
    CommunitySummaryUpdatesResponse,
} from "openchat-shared";
import { applyOptionUpdate, mapOptionUpdate } from "./mapping";

export function mergeCommunities(
    userCanisterCommunities: UserCanisterCommunitySummary[],
    communityCanisterCommunities: CommunitySummary[]
): CommunitySummary[] {
    const userCanisterCommunityLookup = CommunityMap.fromList(userCanisterCommunities);

    return communityCanisterCommunities.map((community) => {
        const _u = userCanisterCommunityLookup.get(community.id);

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

        const channelsUpdated = c?.channelsUpdated ?? [];

        // TOOD we have to somehow merge the currentChannels, the user updates and the community updates
        // all together - actually I think it's just a copy of mergeGroupChatUpdates called
        // mergeChannelUpdates - but that's a tomorrow job

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
            },
            channels: community.channels, // TODO
        };
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
