import {
    CommunityCanisterCommunitySummaryUpdates,
    CommunityMap,
    UserCanisterCommunitySummaryUpdates,
    type CommunitySummary,
    type CommunitySummaryResponse,
    type UserCanisterCommunitySummary,
    CommunitySummaryUpdatesResponse,
} from "openchat-shared";

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
    _userCanisterUpdates: UserCanisterCommunitySummaryUpdates[],
    _communityCanisterUpdates: CommunityCanisterCommunitySummaryUpdates[]
): CommunitySummary[] {
    // TODO - implement
    return communities;
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
