import type { IDL } from "@dfinity/candid";
import {
    _SERVICE,
    DeleteFrozenGroupResponse,
    FilterGroupsResponse,
    FreezeGroupResponse,
    GroupMatch,
    RecommendedGroupsResponse,
    SearchV2Response,
    SearchResponse,
    UnfreezeGroupResponse,
    AddHotGroupExclusionResponse,
    RemoveHotGroupExclusionResponse,
    SetUpgradeConcurrencyResponse,
    CommunityMatch,
    SearchScope,
    ActiveGroupsResponse,
} from "./types";
export {
    _SERVICE as GroupIndexService,
    DeleteFrozenGroupResponse as ApiDeleteFrozenGroupResponse,
    FilterGroupsResponse as ApiFilterGroupsResponse,
    FreezeGroupResponse as ApiFreezeGroupResponse,
    GroupMatch as ApiGroupMatch,
    RecommendedGroupsResponse as ApiRecommendedGroupsResponse,
    SearchV2Response as ApiSearchResponse,
    SearchResponse as ApiGroupSearchResponse,
    UnfreezeGroupResponse as ApiUnfreezeGroupResponse,
    AddHotGroupExclusionResponse as ApiAddHotGroupExclusionResponse,
    RemoveHotGroupExclusionResponse as ApiRemoveHotGroupExclusionResponse,
    SetUpgradeConcurrencyResponse as ApiSetUpgradeConcurrencyResponse,
    CommunityMatch as ApiCommunityMatch,
    SearchScope as ApiSearchScope,
    ActiveGroupsResponse as ApiActiveGroupsResponse,
};

export const idlFactory: IDL.InterfaceFactory;
