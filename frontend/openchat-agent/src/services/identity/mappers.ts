import type {
    ApiCheckAuthPrincipalResponse,
    ApiCreateIdentityResponse,
    ApiGetDelegationResponse,
    ApiPrepareDelegationResponse,
} from "./candid/idl";
import {
    type CheckAuthPrincipalResponse,
    type CreateIdentityResponse,
    type GetDelegationResponse,
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
    if ("NotFound" in candid) {
        return { kind: "not_found" };
    }
    throw new UnsupportedValueError(
        "Unexpected ApiCheckAuthPrincipalResponse type received",
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
