import type {
    ApiApproveIdentityLinkResponse,
    ApiAuthPrincipalsResponse,
    ApiCheckAuthPrincipalResponse,
    ApiCreateIdentityResponse,
    ApiGenerateChallengeResponse,
    ApiGetDelegationResponse,
    ApiInitiateIdentityLinkResponse,
    ApiPrepareDelegationResponse,
    ApiRemoveIdentityLinkResponse,
    ApiWebAuthnKey,
} from "./candid/idl";
import {
    type ApproveIdentityLinkResponse,
    type AuthenticationPrincipalsResponse,
    type CheckAuthPrincipalResponse,
    type CreateIdentityResponse,
    type GenerateChallengeResponse,
    type GetDelegationResponse,
    type InitiateIdentityLinkResponse,
    type PrepareDelegationResponse,
    type PrepareDelegationSuccess,
    type RemoveIdentityLinkResponse,
    type WebAuthnKey,
    UnsupportedValueError,
} from "openchat-shared";
import { consolidateBytes, optional } from "../../utils/mapping";
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
    if ("OriginatingCanisterInvalid" in candid) {
        return { kind: "originating_canister_invalid" };
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
        return {
            kind: "success",
            userId: optional(candid.Success.user_id, (p) => p.toString()),
            webAuthnKey: optional(candid.Success.webauthn_key, webAuthnKey),
            originatingCanister: candid.Success.originating_canister.toString(),
            isIIPrincipal: candid.Success.is_ii_principal,
        };
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

export function generateChallengeResponse(
    candid: ApiGenerateChallengeResponse,
): GenerateChallengeResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            key: candid.Success.key,
            pngBase64: candid.Success.png_base64,
        };
    }
    if ("AlreadyRegistered" in candid) {
        return { kind: "already_registered" };
    }
    if ("Throttled" in candid) {
        return { kind: "throttled" };
    }
    throw new UnsupportedValueError(
        "Unexpected ApiGenerateChallengeResponse type received",
        candid,
    );
}

export function initiateIdentityLinkResponse(
    candid: ApiInitiateIdentityLinkResponse,
): InitiateIdentityLinkResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("AlreadyRegistered" in candid) {
        return "already_registered";
    }
    if ("AlreadyLinkedToPrincipal" in candid) {
        return "already_linked_to_principal";
    }
    if ("TargetUserNotFound" in candid) {
        return "target_user_not_found";
    }
    if ("PublicKeyInvalid" in candid) {
        return "public_key_invalid";
    }
    if ("OriginatingCanisterInvalid" in candid) {
        return "originating_canister_invalid";
    }
    throw new UnsupportedValueError(
        "Unexpected ApiInitiateIdentityLinkResponse type received",
        candid,
    );
}

export function authPrincipalsResponse(
    candid: ApiAuthPrincipalsResponse,
): AuthenticationPrincipalsResponse {
    if ("NotFound" in candid) {
        return [];
    }

    if ("Success" in candid) {
        return candid.Success.map((p) => ({
            principal: p.principal.toString(),
            originatingCanister: p.originating_canister.toString(),
            isIIPrincipal: p.is_ii_principal,
        }));
    }

    throw new UnsupportedValueError("Unexpected ApiAuthPrincipalResponse type received", candid);
}

export function approveIdentityLinkResponse(
    candid: ApiApproveIdentityLinkResponse,
): ApproveIdentityLinkResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("CallerNotRecognised" in candid) {
        return "caller_not_recognised";
    }
    if ("LinkRequestNotFound" in candid) {
        return "link_request_not_found";
    }
    if ("PrincipalAlreadyLinkedToAnotherOcUser" in candid) {
        return "principal_linked_to_another_oc_user";
    }
    if ("MalformedSignature" in candid || "InvalidSignature" in candid) {
        return "invalid_signature";
    }
    if ("DelegationTooOld" in candid) {
        return "delegation_too_old";
    }
    if ("PrincipalAlreadyLinkedToAnotherOcUser" in candid) {
        return "principal_linked_to_another_oc_user";
    }
    throw new UnsupportedValueError(
        "Unexpected ApiApproveIdentityLinkResponse type received",
        candid,
    );
}

export function removeIdentityLinkResponse(
    candid: ApiRemoveIdentityLinkResponse,
): RemoveIdentityLinkResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("CannotUnlinkActivePrincipal" in candid) {
        return "cannot_unlink_active_principal";
    }
    if ("IdentityLinkNotFound" in candid) {
        return "identity_link_not_found";
    }
    if ("UserNotFound" in candid) {
        return "user_not_found";
    }
    throw new UnsupportedValueError(
        "Unexpected ApiRemoveIdentityLinkResponse type received",
        candid,
    );
}

function webAuthnKey(key: ApiWebAuthnKey): WebAuthnKey {
    return {
        publicKey: consolidateBytes(key.public_key),
        credentialId: consolidateBytes(key.credential_id),
        origin: key.origin,
        crossPlatform: key.cross_platform,
        aaguid: consolidateBytes(key.aaguid),
    };
}

export function apiWebAuthnKey(key: WebAuthnKey): ApiWebAuthnKey {
    return {
        public_key: key.publicKey,
        credential_id: key.credentialId,
        origin: key.origin,
        cross_platform: key.crossPlatform,
        aaguid: key.aaguid,
    };
}
