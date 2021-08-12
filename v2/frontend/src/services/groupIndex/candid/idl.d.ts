import type { IDL } from "@dfinity/candid";
import { _SERVICE, CreateArgs, CreateResponse } from "./types";
export {
    _SERVICE as GroupIndexService,
    CreateArgs as ApiCreateArgs,
    CreateResponse as ApiCreateResponse,
};

declare const idlFactory: IDL.InterfaceFactory;
export default idlFactory;
