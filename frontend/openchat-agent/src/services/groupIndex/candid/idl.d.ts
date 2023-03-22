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
    SetGroupUpgradeConcurrencyResponse
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
    SetGroupUpgradeConcurrencyResponse as ApiSetGroupUpgradeConcurrencyResponse,
};

export const idlFactory: IDL.InterfaceFactory;
