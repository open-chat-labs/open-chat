import type { IDL } from "@dfinity/candid";
import { _SERVICE, SearchResponse, GroupMatch } from "./types";
export {
    _SERVICE as GroupIndexService,
    SearchResponse as ApiSearchResponse,
    GroupMatch as ApiGroupMatch,
};

export const idlFactory: IDL.InterfaceFactory;
