import type { IDL } from "@dfinity/candid";
import {
    _SERVICE,
    DeleteFrozenGroupResponse,
    FilterGroupsResponse,
    FreezeGroupResponse,
    GroupMatch,
    RecommendedGroupsResponse,
    SearchResponse,
    UnfreezeGroupResponse,
    AddHotGroupExclusionResponse,
    RemoveHotGroupExclusionResponse,
    SetUpgradeConcurrencyResponse,
    CommunityMatch,
    ActiveGroupsResponse,
    ExploreCommunitiesResponse,
    ExploreCommunitiesSuccess,
} from "./types";
export {
    _SERVICE as GroupIndexService,
    DeleteFrozenGroupResponse as ApiDeleteFrozenGroupResponse,
    FilterGroupsResponse as ApiFilterGroupsResponse,
    FreezeGroupResponse as ApiFreezeGroupResponse,
    GroupMatch as ApiGroupMatch,
    RecommendedGroupsResponse as ApiRecommendedGroupsResponse,
    SearchResponse as ApiSearchResponse,
    UnfreezeGroupResponse as ApiUnfreezeGroupResponse,
    AddHotGroupExclusionResponse as ApiAddHotGroupExclusionResponse,
    RemoveHotGroupExclusionResponse as ApiRemoveHotGroupExclusionResponse,
    SetUpgradeConcurrencyResponse as ApiSetUpgradeConcurrencyResponse,
    CommunityMatch as ApiCommunityMatch,
    ActiveGroupsResponse as ApiActiveGroupsResponse,
    ExploreCommunitiesResponse as ApiExploreCommunitiesResponse,
    ExploreCommunitiesSuccess as ApiExploreCommunitiesSuccess,
};

export const idlFactory: IDL.InterfaceFactory;
