import type { HttpAgent, Identity, SignIdentity } from "@dfinity/agent";
import {
    Empty,
    IdentityApproveIdentityLinkArgs,
    IdentityAuthPrincipalsResponse,
    IdentityCheckAuthPrincipalV2Response,
    IdentityCreateIdentityArgs,
    IdentityCreateIdentityResponse,
    IdentityDeleteUserArgs,
    IdentityGenerateChallengeResponse,
    IdentityGetDelegationArgs,
    IdentityGetDelegationResponse,
    IdentityInitiateIdentityLinkArgs,
    IdentityInitiateIdentityLinkResponse,
    IdentityLookupWebauthnPubkeyArgs,
    IdentityLookupWebauthnPubkeyResponse,
    IdentityPrepareDelegationArgs,
    IdentityPrepareDelegationResponse,
    IdentityRemoveIdentityLinkArgs,
    IdentityRemoveIdentityLinkResponse,
    UnitResult as TUnitResult,
    IdentityCreateAccountLinkingCodeResponse,
    IdentityVerifyAccountLinkingCodeArgs,
    IdentityVerifyAccountLinkingCodeResponse,
    IdentityFinaliseAccountLinkingWithCodeArgs,
    IdentityFinaliseAccountLinkingWithCodeResponse,
} from "../../typebox";
import type {
    ApproveIdentityLinkResponse,
    AuthenticationPrincipalsResponse,
    ChallengeAttempt,
    CheckAuthPrincipalResponse,
    CreateIdentityResponse,
    GenerateChallengeResponse,
    GetDelegationResponse,
    InitiateIdentityLinkResponse,
    OCError,
    PrepareDelegationResponse,
    RemoveIdentityLinkResponse,
    Success,
    WebAuthnKeyFull,
    AccountLinkingCode,
    VerifyAccountLinkingCodeResponse,
} from "openchat-shared";
import {
    apiWebAuthnKey,
    authPrincipalsResponse,
    checkAuthPrincipalResponse,
    createIdentityResponse,
    generateChallengeResponse,
    getDelegationResponse,
    initiateIdentityLinkResponse,
    prepareDelegationResponse,
    removeIdentityLinkResponse,
    mapAccountLinkingErrorCode,
} from "./mappers";
import { consolidateBytes, mapOptional, principalStringToBytes } from "../../utils/mapping";
import type { DelegationIdentity } from "@dfinity/identity";
import { signedDelegation } from "../../utils/id";
import { unitResult } from "../common/chatMappersV2";
import { MsgpackCanisterAgent } from "../canisterAgent/msgpack";

export class IdentityClient extends MsgpackCanisterAgent {
    constructor(identity: Identity, agent: HttpAgent, identityCanister: string) {
        super(identity, agent, identityCanister, "Identity");
    }

    createIdentity(
        sessionKey: Uint8Array,
        webAuthnKey: WebAuthnKeyFull | undefined,
        isIIPrincipal: boolean | undefined,
        challengeAttempt: ChallengeAttempt | undefined,
    ): Promise<CreateIdentityResponse> {
        const args = {
            public_key: this.publicKey(),
            webauthn_key: mapOptional(webAuthnKey, apiWebAuthnKey),
            session_key: sessionKey,
            is_ii_principal: isIIPrincipal,
            max_time_to_live: undefined,
            challenge_attempt: challengeAttempt,
        };
        return this.executeMsgpackUpdate(
            "create_identity",
            args,
            createIdentityResponse,
            IdentityCreateIdentityArgs,
            IdentityCreateIdentityResponse,
        );
    }

    checkAuthPrincipal(): Promise<CheckAuthPrincipalResponse> {
        return this.executeMsgpackQuery(
            "check_auth_principal_v2",
            {},
            checkAuthPrincipalResponse,
            Empty,
            IdentityCheckAuthPrincipalV2Response,
        );
    }

    prepareDelegation(
        sessionKey: Uint8Array,
        isIIPrincipal: boolean | undefined,
    ): Promise<PrepareDelegationResponse> {
        const args = {
            session_key: sessionKey,
            is_ii_principal: isIIPrincipal,
            max_time_to_live: undefined,
        };
        return this.executeMsgpackUpdate(
            "prepare_delegation",
            args,
            prepareDelegationResponse,
            IdentityPrepareDelegationArgs,
            IdentityPrepareDelegationResponse,
        );
    }

    getDelegation(sessionKey: Uint8Array, expiration: bigint): Promise<GetDelegationResponse> {
        const args = {
            session_key: sessionKey,
            expiration,
        };
        return this.executeMsgpackQuery(
            "get_delegation",
            args,
            getDelegationResponse,
            IdentityGetDelegationArgs,
            IdentityGetDelegationResponse,
        );
    }

    generateChallenge(): Promise<GenerateChallengeResponse> {
        return this.executeMsgpackUpdate(
            "generate_challenge",
            {},
            generateChallengeResponse,
            Empty,
            IdentityGenerateChallengeResponse,
        );
    }

    initiateIdentityLink(
        linkToPrincipal: string,
        webAuthnKey: WebAuthnKeyFull | undefined,
        isIIPrincipal: boolean | undefined,
    ): Promise<InitiateIdentityLinkResponse> {
        return this.executeMsgpackUpdate(
            "initiate_identity_link",
            {
                link_to_principal: principalStringToBytes(linkToPrincipal),
                webauthn_key: mapOptional(webAuthnKey, apiWebAuthnKey),
                public_key: this.publicKey(),
                is_ii_principal: isIIPrincipal,
            },
            initiateIdentityLinkResponse,
            IdentityInitiateIdentityLinkArgs,
            IdentityInitiateIdentityLinkResponse,
        );
    }

    approveIdentityLink(linkInitiatedBy: string): Promise<ApproveIdentityLinkResponse> {
        return this.executeMsgpackUpdate(
            "approve_identity_link",
            {
                link_initiated_by: principalStringToBytes(linkInitiatedBy),
                public_key: this.publicKey(),
                delegation: signedDelegation((this.identity as DelegationIdentity).getDelegation()),
            },
            unitResult,
            IdentityApproveIdentityLinkArgs,
            TUnitResult,
        );
    }

    removeIdentityLink(linked_principal: string): Promise<RemoveIdentityLinkResponse> {
        return this.executeMsgpackUpdate(
            "remove_identity_link",
            {
                linked_principal: principalStringToBytes(linked_principal),
            },
            removeIdentityLinkResponse,
            IdentityRemoveIdentityLinkArgs,
            IdentityRemoveIdentityLinkResponse,
        );
    }

    deleteUser(): Promise<Success | OCError> {
        return this.executeMsgpackUpdate(
            "delete_user",
            {
                public_key: this.publicKey(),
                delegation: signedDelegation((this.identity as DelegationIdentity).getDelegation()),
            },
            unitResult,
            IdentityDeleteUserArgs,
            TUnitResult,
        );
    }

    getAuthenticationPrincipals(): Promise<AuthenticationPrincipalsResponse> {
        return this.executeMsgpackQuery(
            "auth_principals",
            {},
            authPrincipalsResponse,
            Empty,
            IdentityAuthPrincipalsResponse,
        );
    }

    lookupWebAuthnPubKey(credentialId: Uint8Array): Promise<Uint8Array | undefined> {
        const args = {
            credential_id: credentialId,
        };
        return this.executeMsgpackQuery(
            "lookup_webauthn_pubkey",
            args,
            (resp) => {
                return typeof resp === "object" && "Success" in resp
                    ? consolidateBytes(resp.Success.pubkey)
                    : undefined;
            },
            IdentityLookupWebauthnPubkeyArgs,
            IdentityLookupWebauthnPubkeyResponse,
        );
    }

    createAccountLinkingCode(): Promise<AccountLinkingCode | undefined> {
        return this.executeMsgpackUpdate(
            "create_account_linking_code",
            {},
            (resp) => {
                return typeof resp === "object" && "Success" in resp
                    ? { value: resp.Success.value, expiresAt: resp.Success.expires_at }
                    : undefined;
            },
            Empty,
            IdentityCreateAccountLinkingCodeResponse,
        );
    }

    verifyAccountLinkingCode(code: string): Promise<VerifyAccountLinkingCodeResponse> {
        return this.executeMsgpackUpdate(
            "verify_account_linking_code",
            { code },
            (resp) => {
                return "Success" in resp
                    ? { kind: "success", username: resp.Success }
                    : { kind: "error", code: mapAccountLinkingErrorCode(resp.Error[0]) };
            },
            IdentityVerifyAccountLinkingCodeArgs,
            IdentityVerifyAccountLinkingCodeResponse,
        );
    }

    finaliseAccountLinkingWithCode(
        principal: string,
        publicKey: Uint8Array,
        sessionKey: Uint8Array,
        webAuthnKey?: WebAuthnKeyFull,
    ): Promise<IdentityFinaliseAccountLinkingWithCodeResponse> {
        const args = {
            principal,
            public_key: publicKey,
            session_key: sessionKey,
            max_time_to_live: undefined,
            webauthn_key: mapOptional(webAuthnKey, apiWebAuthnKey),
        };
        return this.executeMsgpackUpdate(
            "finalise_account_linking_with_code",
            args,
            (resp) => resp,
            IdentityFinaliseAccountLinkingWithCodeArgs,
            IdentityFinaliseAccountLinkingWithCodeResponse,
        );
    }

    private publicKey(): Uint8Array {
        return new Uint8Array((this.identity as SignIdentity).getPublicKey().toDer());
    }
}
