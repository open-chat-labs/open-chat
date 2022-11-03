import type { IDL } from "@dfinity/candid";
import { _SERVICE, FreezeGroupResponse, GroupMatch, SearchResponse } from "./types";
export {
    _SERVICE as GroupIndexService,
    SearchResponse as ApiSearchResponse,
    GroupMatch as ApiGroupMatch,
    FreezeGroupResponse as ApiFreezeGroupResponse,
};

export const idlFactory: IDL.InterfaceFactory;
