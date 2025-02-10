import type { HttpAgent, Identity, SignIdentity } from "@dfinity/agent";
import { idlFactory, type IdentityService } from "./candid/idl";
import { CandidCanisterAgent } from "../canisterAgent/candid";
import type {
    ApproveIdentityLinkResponse,
    AuthenticationPrincipalsResponse,
    ChallengeAttempt,
    CheckAuthPrincipalResponse,
    CreateIdentityResponse,
    GenerateChallengeResponse,
    GetDelegationResponse,
    InitiateIdentityLinkResponse,
    PrepareDelegationResponse,
    RemoveIdentityLinkResponse,
    WebAuthnKey,
} from "openchat-shared";
import {
    approveIdentityLinkResponse,
    authPrincipalsResponse,
    checkAuthPrincipalResponse,
    createIdentityResponse,
    generateChallengeResponse,
    getDelegationResponse,
    initiateIdentityLinkResponse,
    prepareDelegationResponse,
    removeIdentityLinkResponse,
} from "./mappers";
import type { CreateIdentityArgs } from "./candid/types";
import { apiOptional } from "../common/chatMappers";
import { consolidateBytes, identity } from "../../utils/mapping";
import { Principal } from "@dfinity/principal";
import type { DelegationIdentity } from "@dfinity/identity";
import { signedDelegation } from "../../utils/id";

export class IdentityClient extends CandidCanisterAgent<IdentityService> {
    constructor(identity: Identity, agent: HttpAgent, identityCanister: string) {
        super(identity, agent, identityCanister, idlFactory, "Identity");
    }

    createIdentity(
        sessionKey: Uint8Array,
        webAuthnKey: WebAuthnKey | undefined,
        isIIPrincipal: boolean | undefined,
        challengeAttempt: ChallengeAttempt | undefined,
    ): Promise<CreateIdentityResponse> {
        const args: CreateIdentityArgs = {
            public_key: webAuthnKey?.pubkey ?? this.publicKey(),
            webauthn_key: apiOptional((k) => ({
                credential_id: k.credentialId,
                origin: k.origin,
                cross_platform: k.crossPlatform,
            }), webAuthnKey),
            session_key: sessionKey,
            is_ii_principal: apiOptional(identity, isIIPrincipal),
            max_time_to_live: [] as [] | [bigint],
            challenge_attempt: apiOptional(identity, challengeAttempt),
        };
        return this.handleResponse(
            this.service.create_identity(args),
            createIdentityResponse,
            args,
        );
    }

    checkAuthPrincipal(): Promise<CheckAuthPrincipalResponse> {
        return this.handleQueryResponse(
            () => this.service.check_auth_principal({}),
            checkAuthPrincipalResponse,
            {},
        );
    }

    prepareDelegation(
        sessionKey: Uint8Array,
        isIIPrincipal: boolean | undefined,
    ): Promise<PrepareDelegationResponse> {
        const args = {
            session_key: sessionKey,
            is_ii_principal: apiOptional(identity, isIIPrincipal),
            max_time_to_live: [] as [] | [bigint],
        };
        return this.handleResponse(
            this.service.prepare_delegation(args),
            prepareDelegationResponse,
            args,
        );
    }

    getDelegation(sessionKey: Uint8Array, expiration: bigint): Promise<GetDelegationResponse> {
        const args = {
            session_key: sessionKey,
            expiration,
        };
        return this.handleQueryResponse(
            () => this.service.get_delegation(args),
            getDelegationResponse,
            args,
        );
    }

    generateChallenge(): Promise<GenerateChallengeResponse> {
        return this.handleResponse(this.service.generate_challenge({}), generateChallengeResponse);
    }

    initiateIdentityLink(
        linkToPrincipal: string,
        isIIPrincipal: boolean | undefined,
    ): Promise<InitiateIdentityLinkResponse> {
        return this.handleResponse(
            this.service.initiate_identity_link({
                link_to_principal: Principal.fromText(linkToPrincipal),
                public_key: this.publicKey(),
                is_ii_principal: apiOptional(identity, isIIPrincipal),
            }),
            initiateIdentityLinkResponse,
        );
    }

    approveIdentityLink(linkInitiatedBy: string): Promise<ApproveIdentityLinkResponse> {
        return this.handleResponse(
            this.service.approve_identity_link({
                link_initiated_by: Principal.fromText(linkInitiatedBy),
                public_key: this.publicKey(),
                delegation: signedDelegation((this.identity as DelegationIdentity).getDelegation()),
            }),
            approveIdentityLinkResponse,
        );
    }

    removeIdentityLink(linked_principal: string): Promise<RemoveIdentityLinkResponse> {
        return this.handleResponse(
            this.service.remove_identity_link({
                linked_principal: Principal.fromText(linked_principal),
            }),
            removeIdentityLinkResponse,
        );
    }

    getAuthenticationPrincipals(): Promise<AuthenticationPrincipalsResponse> {
        return this.handleQueryResponse(
            () => this.service.auth_principals({}),
            authPrincipalsResponse,
        );
    }

    lookupWebAuthnPubKey(credentialId: Uint8Array): Promise<Uint8Array | undefined> {
        const args = {
            credential_id: credentialId,
        };
        return this.handleQueryResponse(
            () => this.service.lookup_webauthn_pubkey(args),
            (resp) => {
                if ("Success" in resp) {
                    return consolidateBytes(resp.Success.pubkey);
                } else {
                    return undefined;
                }
            },
            args
        );
    }

    private publicKey(): Uint8Array {
        return new Uint8Array((this.identity as SignIdentity).getPublicKey().toDer());
    }
}
