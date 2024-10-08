import type { HttpAgent, Identity, SignIdentity } from "@dfinity/agent";
import { idlFactory, type IdentityService } from "./candid/idl";
import { CandidService } from "../candidService";
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
} from "./mappers";
import type { CreateIdentityArgs } from "./candid/types";
import { apiOptional } from "../common/chatMappers";
import { identity } from "../../utils/mapping";
import { Principal } from "@dfinity/principal";
import type { DelegationIdentity } from "@dfinity/identity";
import { signedDelegation } from "../../utils/id";

export class IdentityClient extends CandidService {
    private service: IdentityService;

    constructor(identity: Identity, agent: HttpAgent, identityCanister: string) {
        super(identity, agent, identityCanister);

        this.service = this.createServiceClient<IdentityService>(idlFactory);
    }

    createIdentity(
        sessionKey: Uint8Array,
        isIIPrincipal: boolean | undefined,
        challengeAttempt: ChallengeAttempt | undefined,
    ): Promise<CreateIdentityResponse> {
        const args: CreateIdentityArgs = {
            public_key: this.publicKey(),
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

    getAuthenticationPrincipals(): Promise<AuthenticationPrincipalsResponse> {
        return this.handleQueryResponse(
            () => this.service.auth_principals({}),
            authPrincipalsResponse,
        );
    }

    private publicKey(): Uint8Array {
        return new Uint8Array((this.identity as SignIdentity).getPublicKey().toDer());
    }
}
