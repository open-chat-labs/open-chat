import type { IDL } from "@dfinity/candid";

import {
    _SERVICE,
    ListNervousSystemFunctionsResponse,
    ListProposalsResponse,
    ManageNeuronResponse,
    NervousSystemFunction,
    FunctionType,
} from "./types";
export {
    _SERVICE as SnsGovernanceService,
    ListNervousSystemFunctionsResponse as ApiListNervousSystemFunctionsResponse,
    ListProposalsResponse as ApiListProposalsResponse,
    ManageNeuronResponse as ApiManageNeuronResponse,
    NervousSystemFunction as ApiNervousSystemFunction,
    FunctionType as ApiSnsFunctionType,
};

export const idlFactory: IDL.InterfaceFactory;
