import type { IDL } from "@dfinity/candid";
import {
    _SERVICE,
    ProposeResponse,
    ApproveResponse,
    RejectResponse,
    ProposedResponse,
    MarkDeployedResponse,
    CandidateTranslation,
    PendingDeploymentResponse,
    RejectReason
} from "./types";
export {
    _SERVICE as TranslationsService,
    ProposeResponse as ApiProposeResponse,
    ApproveResponse as ApiApproveResponse,
    RejectResponse as ApiRejectResponse,
    MarkDeployedResponse as ApiMarkDeployedResponse,
    ProposedResponse as ApiProposedResponse,
    CandidateTranslation as ApiCandidateTranslation,
    PendingDeploymentResponse as ApiPendingDeploymentResponse,
    RejectReason as ApiRejectReason
};

export const idlFactory: IDL.InterfaceFactory;
