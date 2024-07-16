import type { IDL } from "@dfinity/candid";
import {
    ApproveIdentityLinkResponse,
    CheckAuthPrincipalResponse,
    CreateIdentityResponse,
    GenerateChallengeResponse,
    GetDelegationResponse,
    InitiateIdentityLinkResponse,
    PrepareDelegationResponse,
    SignedDelegation,
    _SERVICE,
} from "./types";
export {
    ApproveIdentityLinkResponse as ApiApproveIdentityLinkResponse,
    CheckAuthPrincipalResponse as ApiCheckAuthPrincipalResponse,
    CreateIdentityResponse as ApiCreateIdentityResponse,
    GenerateChallengeResponse as ApiGenerateChallengeResponse,
    GetDelegationResponse as ApiGetDelegationResponse,
    InitiateIdentityLinkResponse as ApiInitiateIdentityLinkResponse,
    PrepareDelegationResponse as ApiPrepareDelegationResponse,
    SignedDelegation as ApiSignedDelegation,
    _SERVICE as IdentityService,
};

export const idlFactory: IDL.InterfaceFactory;
