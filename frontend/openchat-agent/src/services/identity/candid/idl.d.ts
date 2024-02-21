import type { IDL } from "@dfinity/candid";
import {
    CheckAuthPrincipalResponse,
    CreateIdentityResponse,
    GetDelegationResponse,
    MigrateLegacyPrincipalResponse,
    PrepareDelegationResponse,
    _SERVICE,
} from "./types";
export {
    CheckAuthPrincipalResponse as ApiCheckAuthPrincipalResponse,
    CreateIdentityResponse as ApiCreateIdentityResponse,
    GetDelegationResponse as ApiGetDelegationResponse,
    MigrateLegacyPrincipalResponse as ApiMigrateLegacyPrincipalResponse,
    PrepareDelegationResponse as ApiPrepareDelegationResponse,
    _SERVICE as IdentityService,
};

export const idlFactory: IDL.InterfaceFactory;
