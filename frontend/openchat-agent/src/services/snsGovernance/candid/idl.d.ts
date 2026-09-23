import type { IDL } from "@icp-sdk/core/candid";

import {
    _SERVICE,
    ListNervousSystemFunctionsResponse,
    ListNeurons,
    ListNeuronsResponse,
    ListProposalsResponse,
    ManageNeuronResponse,
    NervousSystemFunction,
    FunctionType,
} from "./types";
export {
    _SERVICE as SnsGovernanceService,
    ListNervousSystemFunctionsResponse as ApiListNervousSystemFunctionsResponse,
    ListNeurons as ApiListNeurons,
    ListNeuronsResponse as ApiListNeuronsResponse,
    ListProposalsResponse as ApiListProposalsResponse,
    ManageNeuronResponse as ApiManageNeuronResponse,
    NervousSystemFunction as ApiNervousSystemFunction,
    FunctionType as ApiSnsFunctionType,
};

export const idlFactory: IDL.InterfaceFactory;
