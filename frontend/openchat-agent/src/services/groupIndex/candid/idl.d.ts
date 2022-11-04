import type { IDL } from "@dfinity/candid";
import { _SERVICE, FreezeGroupResponse, GroupMatch, SearchResponse, UnfreezeGroupResponse } from "./types";
export {
    _SERVICE as GroupIndexService,
    SearchResponse as ApiSearchResponse,
    GroupMatch as ApiGroupMatch,
    FreezeGroupResponse as ApiFreezeGroupResponse,
    UnfreezeGroupResponse as ApiUnfreezeGroupResponse,
};

export const idlFactory: IDL.InterfaceFactory;
