import type { IDL } from "@dfinity/candid";
import { _SERVICE, FilterGroupsResponse, FreezeGroupResponse, GroupMatch, SearchResponse, UnfreezeGroupResponse } from "./types";
export {
    _SERVICE as GroupIndexService,
    FilterGroupsResponse as ApiFilterGroupsResponse,
    SearchResponse as ApiSearchResponse,
    GroupMatch as ApiGroupMatch,
    FreezeGroupResponse as ApiFreezeGroupResponse,
    UnfreezeGroupResponse as ApiUnfreezeGroupResponse,
};

export const idlFactory: IDL.InterfaceFactory;
