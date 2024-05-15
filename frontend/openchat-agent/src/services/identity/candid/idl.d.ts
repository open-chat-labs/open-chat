import type { IDL } from "@dfinity/candid";
import {
    CheckAuthPrincipalResponse,
    CreateIdentityResponse,
    GetDelegationResponse,
    PrepareDelegationResponse,
    _SERVICE,
} from "./types";
export {
    CheckAuthPrincipalResponse as ApiCheckAuthPrincipalResponse,
    CreateIdentityResponse as ApiCreateIdentityResponse,
    GetDelegationResponse as ApiGetDelegationResponse,
    PrepareDelegationResponse as ApiPrepareDelegationResponse,
    _SERVICE as IdentityService,
};

export const idlFactory: IDL.InterfaceFactory;
