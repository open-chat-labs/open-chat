import type { IDL } from "@dfinity/candid";
import {
    CheckAuthPrincipalResponse,
    CreateIdentityResponse,
    GetDelegationResponse,
    PrepareDelegationResponse,
    GenerateChallengeResponse,
    _SERVICE,
} from "./types";
export {
    CheckAuthPrincipalResponse as ApiCheckAuthPrincipalResponse,
    CreateIdentityResponse as ApiCreateIdentityResponse,
    GetDelegationResponse as ApiGetDelegationResponse,
    PrepareDelegationResponse as ApiPrepareDelegationResponse,
    GenerateChallengeResponse as ApiGenerateChallengeResponse,
    _SERVICE as IdentityService,
};

export const idlFactory: IDL.InterfaceFactory;
