import type { IDL } from "@dfinity/candid";

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
