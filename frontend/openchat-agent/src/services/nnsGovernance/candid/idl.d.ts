import type { IDL } from "@icp-sdk/core/candid";

import {
    _SERVICE,
    ListProposalInfoResponse,
    ManageNeuronResponse,
} from "./types";
export {
    _SERVICE as NnsGovernanceService,
    ListProposalInfoResponse as ApiListProposalInfoResponse,
    ManageNeuronResponse as ApiManageNeuronResponse,
};

export const idlFactory: IDL.InterfaceFactory;
