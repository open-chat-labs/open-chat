import type { IDL } from "@dfinity/candid";
import {
    ApproveIdentityLinkResponse,
    CheckAuthPrincipalV2Response,
    CreateIdentityResponse,
    GenerateChallengeResponse,
    GetDelegationResponse,
    InitiateIdentityLinkResponse,
    PrepareDelegationResponse,
    SignedDelegation,
    AuthPrincipalsResponse,
    RemoveIdentityLinkResponse,
    WebAuthnKey,
    _SERVICE,
} from "./types";
export {
    ApproveIdentityLinkResponse as ApiApproveIdentityLinkResponse,
    CheckAuthPrincipalV2Response as ApiCheckAuthPrincipalResponse,
    CreateIdentityResponse as ApiCreateIdentityResponse,
    GenerateChallengeResponse as ApiGenerateChallengeResponse,
    GetDelegationResponse as ApiGetDelegationResponse,
    InitiateIdentityLinkResponse as ApiInitiateIdentityLinkResponse,
    PrepareDelegationResponse as ApiPrepareDelegationResponse,
    SignedDelegation as ApiSignedDelegation,
    AuthPrincipalsResponse as ApiAuthPrincipalsResponse,
    RemoveIdentityLinkResponse as ApiRemoveIdentityLinkResponse,
    WebAuthnKey as ApiWebAuthnKey,
    _SERVICE as IdentityService,
};

export const idlFactory: IDL.InterfaceFactory;
