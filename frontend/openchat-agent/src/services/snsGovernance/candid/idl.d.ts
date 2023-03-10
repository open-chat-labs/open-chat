import type { IDL } from "@dfinity/candid";

import {
    _SERVICE,
    ListNervousSystemFunctionsResponse,
    ListProposalsResponse,
    NervousSystemFunction,
    FunctionType,
} from "./types";
export {
    _SERVICE as SnsGovernanceService,
    ListNervousSystemFunctionsResponse as ApiListNervousSystemFunctionsResponse,
    ListProposalsResponse as ApiListProposalsResponse,
    NervousSystemFunction as ApiNervousSystemFunction,
    FunctionType as ApiSnsFunctionType,
};

export const idlFactory: IDL.InterfaceFactory;
