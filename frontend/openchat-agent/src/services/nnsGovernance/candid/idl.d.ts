import type { IDL } from "@icp-sdk/core/candid";

import {
    _SERVICE,
    ListNeurons,
    ListNeuronsResponse,
    ListProposalInfoResponse,
    ManageNeuronResponse,
} from "./types";
export {
    _SERVICE as NnsGovernanceService,
    ListNeurons as ApiListNeurons,
    ListNeuronsResponse as ApiListNeuronsResponse,
    ListProposalInfoResponse as ApiListProposalInfoResponse,
    ManageNeuronResponse as ApiManageNeuronResponse,
};

export const idlFactory: IDL.InterfaceFactory;
