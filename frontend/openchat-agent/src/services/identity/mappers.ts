import type {
    IdentityAuthPrincipalsResponse,
    IdentityCheckAuthPrincipalV2Response,
    IdentityCreateIdentityResponse,
    IdentityGenerateChallengeResponse,
    IdentityGetDelegationResponse,
    IdentityInitiateIdentityLinkResponse,
    IdentityPrepareDelegationResponse,
    IdentityRemoveIdentityLinkResponse,
    IdentityWebAuthnKey,
    SignedDelegation,
} from "../../typebox";
import type {
    AuthenticationPrincipalsResponse,
    CheckAuthPrincipalResponse,
    CreateIdentityResponse,
    GenerateChallengeResponse,
    GetDelegationResponse,
    InitiateIdentityLinkResponse,
    PrepareDelegationResponse,
    PrepareDelegationSuccess,
    RemoveIdentityLinkResponse,
    WebAuthnKeyFull,
} from "openchat-shared";
import { AccountLinkingErrorCode, UnsupportedValueError } from "openchat-shared";
import { consolidateBytes, mapOptional, principalBytesToString } from "../../utils/mapping";
import type { Signature } from "@dfinity/agent";
import { Delegation } from "@dfinity/identity";

export function createIdentityResponse(
    value: IdentityCreateIdentityResponse,
): CreateIdentityResponse {
    if (value === "AlreadyRegistered") {
        return { kind: "already_registered" };
    }
    if (value === "ChallengeFailed") {
        return { kind: "challenge_failed" };
    }
    if (value === "ChallengeRequired") {
        return { kind: "challenge_required" };
    }
    if ("Success" in value) {
        return prepareDelegationSuccess(value.Success);
    }
    if ("PublicKeyInvalid" in value) {
        return { kind: "public_key_invalid" };
    }
    if ("OriginatingCanisterInvalid" in value) {
        return { kind: "originating_canister_invalid" };
    }
    throw new UnsupportedValueError("Unexpected ApiCreateIdentityResponse type received", value);
}

export function checkAuthPrincipalResponse(
    value: IdentityCheckAuthPrincipalV2Response,
): CheckAuthPrincipalResponse {
    if (value === "NotFound") {
        return { kind: "not_found" };
    }
    if ("Success" in value) {
        return {
            kind: "success",
            userId: mapOptional(value.Success.user_id, principalBytesToString),
            webAuthnKey: mapOptional(value.Success.webauthn_key, webAuthnKey),
            originatingCanister: principalBytesToString(value.Success.originating_canister),
            isIIPrincipal: value.Success.is_ii_principal,
        };
    }
    throw new UnsupportedValueError(
        "Unexpected ApiCheckAuthPrincipalResponse type received",
        value,
    );
}

export function prepareDelegationResponse(
    value: IdentityPrepareDelegationResponse,
): PrepareDelegationResponse {
    if (value === "NotFound") {
        return { kind: "not_found" };
    }
    if ("Success" in value) {
        return prepareDelegationSuccess(value.Success);
    }
    throw new UnsupportedValueError("Unexpected ApiPrepareDelegationResponse type received", value);
}

export function getDelegationResponse(
    value: IdentityGetDelegationResponse | { NotFound: null },
): GetDelegationResponse {
    if (value === "NotFound" || "NotFound" in value) {
        return { kind: "not_found" };
    }
    if ("Success" in value) {
        return signedDelegation(value.Success);
    }
    throw new UnsupportedValueError("Unexpected ApiGetDelegationResponse type received", value);
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

function prepareDelegationSuccess(value: {
    user_key: Uint8Array | number[];
    expiration: bigint;
}): PrepareDelegationSuccess {
    return {
        kind: "success",
        userKey: consolidateBytes(value.user_key),
        expiration: value.expiration,
    };
}

export function generateChallengeResponse(
    value: IdentityGenerateChallengeResponse,
): GenerateChallengeResponse {
    if (value === "AlreadyRegistered") {
        return { kind: "already_registered" };
    }
    if (value === "Throttled") {
        return { kind: "throttled" };
    }
    if ("Success" in value) {
        return {
            kind: "success",
            key: value.Success.key,
            pngBase64: value.Success.png_base64,
        };
    }
    throw new UnsupportedValueError("Unexpected ApiGenerateChallengeResponse type received", value);
}

export function initiateIdentityLinkResponse(
    value: IdentityInitiateIdentityLinkResponse,
): InitiateIdentityLinkResponse {
    if (value === "Success") {
        return "success";
    }
    if (value === "AlreadyRegistered") {
        return "already_registered";
    }
    if (value === "AlreadyLinkedToPrincipal") {
        return "already_linked_to_principal";
    }
    if (value === "TargetUserNotFound") {
        return "target_user_not_found";
    }
    if ("PublicKeyInvalid" in value) {
        return "public_key_invalid";
    }
    if ("OriginatingCanisterInvalid" in value) {
        return "originating_canister_invalid";
    }
    if ("LinkedIdentitiesLimitReached" in value) {
        return "linked_identities_limit_reached";
    }
    throw new UnsupportedValueError(
        "Unexpected ApiInitiateIdentityLinkResponse type received",
        value,
    );
}

export function authPrincipalsResponse(
    value: IdentityAuthPrincipalsResponse,
): AuthenticationPrincipalsResponse {
    if (value === "NotFound") {
        return [];
    }

    if ("Success" in value) {
        return value.Success.map((p) => ({
            principal: principalBytesToString(p.principal),
            originatingCanister: principalBytesToString(p.originating_canister),
            isIIPrincipal: p.is_ii_principal,
            isCurrentIdentity: p.is_current_identity,
            webAuthnKey: mapOptional(p.webauthn_key, webAuthnKey),
        }));
    }

    throw new UnsupportedValueError("Unexpected ApiAuthPrincipalResponse type received", value);
}

export function removeIdentityLinkResponse(
    value: IdentityRemoveIdentityLinkResponse,
): RemoveIdentityLinkResponse {
    if (value === "Success") {
        return "success";
    }
    if (value === "CannotUnlinkActivePrincipal") {
        return "cannot_unlink_active_principal";
    }
    if (value === "IdentityLinkNotFound") {
        return "identity_link_not_found";
    }
    if (value === "UserNotFound") {
        return "user_not_found";
    }
    throw new UnsupportedValueError(
        "Unexpected ApiRemoveIdentityLinkResponse type received",
        value,
    );
}

function webAuthnKey(key: IdentityWebAuthnKey): WebAuthnKeyFull {
    return {
        publicKey: consolidateBytes(key.public_key),
        credentialId: consolidateBytes(key.credential_id),
        origin: key.origin,
        crossPlatform: key.cross_platform,
        aaguid: consolidateBytes(key.aaguid),
    };
}

export function apiWebAuthnKey(key: WebAuthnKeyFull): IdentityWebAuthnKey {
    return {
        public_key: key.publicKey,
        credential_id: key.credentialId,
        origin: key.origin,
        cross_platform: key.crossPlatform,
        aaguid: [...key.aaguid.values()] as [
            number,
            number,
            number,
            number,
            number,
            number,
            number,
            number,
            number,
            number,
            number,
            number,
            number,
            number,
            number,
            number,
        ],
    };
}

export function mapAccountLinkingErrorCode(code: number): AccountLinkingErrorCode {
    switch (code) {
        case 100:
            return AccountLinkingErrorCode.InitiatorNotFound;
        case 224:
            return AccountLinkingErrorCode.AlreadyRegistered;
        case 225:
            return AccountLinkingErrorCode.PrincipalAlreadyUsed;
        case 259:
            return AccountLinkingErrorCode.InvalidPublicKey;
        case 341:
            return AccountLinkingErrorCode.InvalidOriginatingCanister;
        case 342:
            return AccountLinkingErrorCode.LinkingCodeNotFound;
        case 343:
            return AccountLinkingErrorCode.MaxLinkedIdentitiesLimitReached;
        default:
            return AccountLinkingErrorCode.UnknownError;
    }
}
