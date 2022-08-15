import type { IDL } from "@dfinity/candid";

import {
    _SERVICE,
    ListNervousSystemFunctionsResponse,
    NervousSystemFunction,
    FunctionType,
} from "./types";
export {
    _SERVICE as SnsGovernanceService,
    ListNervousSystemFunctionsResponse as ApiListNervousSystemFunctionsResponse,
    NervousSystemFunction as ApiNervousSystemFunction,
    FunctionType as ApiSnsFunctionType,
};

export const idlFactory: IDL.InterfaceFactory;
