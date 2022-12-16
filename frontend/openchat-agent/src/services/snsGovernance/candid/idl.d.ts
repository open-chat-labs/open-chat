import type { IDL } from "@dfinity/candid";

import {
    _SERVICE,
    GetProposalResponse,
    ListNervousSystemFunctionsResponse,
    NervousSystemFunction,
    FunctionType,
} from "./types";
export {
    _SERVICE as SnsGovernanceService,
    GetProposalResponse as ApiGetProposalResponse,
    ListNervousSystemFunctionsResponse as ApiListNervousSystemFunctionsResponse,
    NervousSystemFunction as ApiNervousSystemFunction,
    FunctionType as ApiSnsFunctionType,
};

export const idlFactory: IDL.InterfaceFactory;
