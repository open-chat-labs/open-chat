import type { IDL } from "@dfinity/candid";
import { _SERVICE, CreateArgs, CreateResponse, SearchResponse, GroupMatch } from "./types";
export {
    _SERVICE as GroupIndexService,
    CreateArgs as ApiCreateArgs,
    CreateResponse as ApiCreateResponse,
    SearchResponse as ApiSearchResponse,
    GroupMatch as ApiGroupMatch,
};

export const idlFactory: IDL.InterfaceFactory;
