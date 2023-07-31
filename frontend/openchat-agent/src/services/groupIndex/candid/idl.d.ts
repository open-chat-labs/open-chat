import type { IDL } from "@dfinity/candid";
import {
    _SERVICE,
    DeleteFrozenGroupResponse,
    FreezeGroupResponse,
    GroupMatch,
    RecommendedGroupsResponse,
    SearchResponse,
    UnfreezeGroupResponse,
    AddHotGroupExclusionResponse,
    RemoveHotGroupExclusionResponse,
    SetCommunityModerationFlagsResponse,
    SetUpgradeConcurrencyResponse,
    CommunityMatch,
    ActiveGroupsResponse,
    ExploreCommunitiesResponse,
    ExploreCommunitiesSuccess,
    LookupChannelByGroupIdResponse,
} from "./types";
export {
    _SERVICE as GroupIndexService,
    DeleteFrozenGroupResponse as ApiDeleteFrozenGroupResponse,
    FreezeGroupResponse as ApiFreezeGroupResponse,
    GroupMatch as ApiGroupMatch,
    RecommendedGroupsResponse as ApiRecommendedGroupsResponse,
    SearchResponse as ApiSearchResponse,
    UnfreezeGroupResponse as ApiUnfreezeGroupResponse,
    AddHotGroupExclusionResponse as ApiAddHotGroupExclusionResponse,
    RemoveHotGroupExclusionResponse as ApiRemoveHotGroupExclusionResponse,
    SetCommunityModerationFlagsResponse as ApiSetCommunityModerationFlagsResponse,
    SetUpgradeConcurrencyResponse as ApiSetUpgradeConcurrencyResponse,
    CommunityMatch as ApiCommunityMatch,
    ActiveGroupsResponse as ApiActiveGroupsResponse,
    ExploreCommunitiesResponse as ApiExploreCommunitiesResponse,
    ExploreCommunitiesSuccess as ApiExploreCommunitiesSuccess,
    LookupChannelByGroupIdResponse as ApiLookupChannelByGroupIdResponse,
};

export const idlFactory: IDL.InterfaceFactory;
