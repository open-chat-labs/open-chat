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
    type PrepareDelegationSuccess,
    UnsupportedValueError,
} from "openchat-shared";
import { consolidateBytes } from "../../utils/mapping";
import type { Signature } from "@dfinity/agent";
import { Delegation } from "@dfinity/identity";
import type { PublicKey, SignedDelegation } from "./candid/types";

export function createIdentityResponse(candid: ApiCreateIdentityResponse): CreateIdentityResponse {
    if ("Success" in candid) {
        return prepareDelegationSuccess(candid.Success);
    }
    if ("AlreadyRegistered" in candid) {
        return { kind: "already_registered" };
    }
    if ("PublicKeyInvalid" in candid) {
        return { kind: "public_key_invalid" };
    }
    if ("ChallengeFailed" in candid) {
        return { kind: "challenge_failed" };
    }
    if ("ChallengeRequired" in candid) {
        return { kind: "challenge_required" };
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
        return prepareDelegationSuccess(candid.Success);
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
        return signedDelegation(candid.Success);
    }
    if ("NotFound" in candid) {
        return { kind: "not_found" };
    }
    throw new UnsupportedValueError("Unexpected ApiGetDelegationResponse type received", candid);
}

export function signedDelegation(signedDelegation: SignedDelegation): GetDelegationResponse {
    return {
        kind: "success",
        delegation: new Delegation(
            consolidateBytes(signedDelegation.delegation.pubkey),
            signedDelegation.delegation.expiration,
        ),
        signature: consolidateBytes(signedDelegation.signature) as unknown as Signature,
    };
}

function prepareDelegationSuccess(candid: {
    user_key: PublicKey;
    expiration: bigint;
}): PrepareDelegationSuccess {
    return {
        kind: "success",
        userKey: consolidateBytes(candid.user_key),
        expiration: candid.expiration,
    };
}
