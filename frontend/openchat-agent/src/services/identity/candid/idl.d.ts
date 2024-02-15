import type { IDL } from "@dfinity/candid";
import {
    CheckAuthPrincipalResponse,
    GetDelegationResponse,
    MigrateLegacyPrincipalResponse,
    PrepareDelegationResponse,
    _SERVICE,
} from "./types";
export {
    CheckAuthPrincipalResponse as ApiCheckAuthPrincipalResponse,
    GetDelegationResponse as ApiGetDelegationResponse,
    MigrateLegacyPrincipalResponse as ApiMigrateLegacyPrincipalResponse,
    PrepareDelegationResponse as ApiPrepareDelegationResponse,
    _SERVICE as IdentityService,
};

export const idlFactory: IDL.InterfaceFactory;
