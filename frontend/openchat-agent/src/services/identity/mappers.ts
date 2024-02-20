import type {
    ApiCheckAuthPrincipalResponse,
    ApiCreateIdentityResponse,
    ApiGetDelegationResponse,
    ApiMigrateLegacyPrincipalResponse,
    ApiPrepareDelegationResponse,
} from "./candid/idl";
import {
    type CheckAuthPrincipalResponse,
    type CreateIdentityResponse,
    type GetDelegationResponse,
    type MigrateLegacyPrincipalResponse,
    type PrepareDelegationResponse,
    UnsupportedValueError,
} from "openchat-shared";
import { consolidateBytes } from "../../utils/mapping";
import type { Signature } from "@dfinity/agent";
import { Delegation } from "@dfinity/identity";

export function createIdentityResponse(candid: ApiCreateIdentityResponse): CreateIdentityResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            userKey: consolidateBytes(candid.Success.user_key),
            expiration: candid.Success.expiration,
        };
    }
    if ("AlreadyRegistered" in candid) {
        return { kind: "already_registered" };
    }
    if ("PublicKeyInvalid" in candid) {
        return { kind: "public_key_invalid" };
    }
    throw new UnsupportedValueError("Unexpected ApiCreateIdentityResponse type received", candid);
}

export function checkAuthPrincipalResponse(
    candid: ApiCheckAuthPrincipalResponse,
): CheckAuthPrincipalResponse {
    if ("Success" in candid) {
        return { kind: "success" };
    }
    if ("Legacy" in candid) {
        return { kind: "legacy" };
    }
    if ("NotFound" in candid) {
        return { kind: "not_found" };
    }
    throw new UnsupportedValueError(
        "Unexpected ApiCheckAuthPrincipalResponse type received",
        candid,
    );
}

export function migrateLegacyPrincipalResponse(
    candid: ApiMigrateLegacyPrincipalResponse,
): MigrateLegacyPrincipalResponse {
    if ("Success" in candid) {
        return { kind: "success", newPrincipal: candid.Success.new_principal.toString() };
    }
    if ("AlreadyMigrated" in candid) {
        return { kind: "already_migrated" };
    }
    if ("NotFound" in candid) {
        return { kind: "not_found" };
    }
    if ("InternalError" in candid) {
        return { kind: "internal_error", error: candid.InternalError };
    }
    throw new UnsupportedValueError(
        "Unexpected ApiMigrateLegacyPrincipalResponse type received",
        candid,
    );
}

export function prepareDelegationResponse(
    candid: ApiPrepareDelegationResponse,
): PrepareDelegationResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            userKey: consolidateBytes(candid.Success.user_key),
            expiration: candid.Success.expiration,
        };
    }
    if ("NotFound" in candid) {
        return { kind: "not_found" };
    }
    throw new UnsupportedValueError(
        "Unexpected ApiPrepareDelegationResponse type received",
        candid,
    );
}

export function getDelegationResponse(candid: ApiGetDelegationResponse): GetDelegationResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            delegation: new Delegation(
                consolidateBytes(candid.Success.delegation.pubkey),
                candid.Success.delegation.expiration,
            ),
            signature: consolidateBytes(candid.Success.signature) as unknown as Signature,
        };
    }
    if ("NotFound" in candid) {
        return { kind: "not_found" };
    }
    throw new UnsupportedValueError("Unexpected ApiGetDelegationResponse type received", candid);
}
