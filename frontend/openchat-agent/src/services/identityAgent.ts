import { IdentityClient } from "./identity/identity.client";
import { HttpAgent, type Identity, type SignIdentity } from "@dfinity/agent";
import { DelegationIdentity } from "@dfinity/identity";
import type {
    ApproveIdentityLinkResponse,
    AuthenticationPrincipalsResponse,
    ChallengeAttempt,
    CreateOpenChatIdentityError,
    GenerateChallengeResponse,
    InitiateIdentityLinkResponse,
} from "openchat-shared";
import { buildDelegationIdentity, toDer } from "openchat-shared";
import { createHttpAgent } from "../utils/httpAgent";

export class IdentityAgent {
    private readonly _identityClient: IdentityClient;
    private readonly _isIIPrincipal: boolean | undefined;

    private constructor(
        identity: Identity,
        agent: HttpAgent,
        identityCanister: string,
        isIIPrincipal: boolean | undefined,
    ) {
        this._identityClient = new IdentityClient(identity, agent, identityCanister);
        this._isIIPrincipal = isIIPrincipal;
    }

    static async create(
        identity: Identity,
        identityCanister: string,
        icUrl: string,
        isIIPrincipal: boolean | undefined,
    ): Promise<IdentityAgent> {
        const agent = await createHttpAgent(identity, icUrl);
        return new IdentityAgent(identity, agent, identityCanister, isIIPrincipal);
    }

    checkOpenChatIdentityExists(): Promise<boolean> {
        return this._identityClient.checkAuthPrincipal().then((resp) => resp.kind === "success");
    }

    async createOpenChatIdentity(
        sessionKey: SignIdentity,
        challengeAttempt: ChallengeAttempt | undefined,
    ): Promise<DelegationIdentity | CreateOpenChatIdentityError> {
        const sessionKeyDer = toDer(sessionKey);
        const createIdentityResponse = await this._identityClient.createIdentity(
            sessionKeyDer,
            this._isIIPrincipal,
            challengeAttempt,
        );

        if (createIdentityResponse.kind === "success") {
            const delegation = await this.getDelegation(
                createIdentityResponse.userKey,
                sessionKey,
                sessionKeyDer,
                createIdentityResponse.expiration,
            );
            if (delegation === undefined) {
                throw new Error("Delegation not found, this should never happen");
            }
            return delegation;
        }
        return createIdentityResponse.kind;
    }

    async getOpenChatIdentity(sessionKey: SignIdentity): Promise<DelegationIdentity | undefined> {
        const sessionKeyDer = toDer(sessionKey);
        const prepareDelegationResponse = await this._identityClient.prepareDelegation(
            sessionKeyDer,
            this._isIIPrincipal,
        );

        return prepareDelegationResponse.kind === "success"
            ? this.getDelegation(
                  prepareDelegationResponse.userKey,
                  sessionKey,
                  sessionKeyDer,
                  prepareDelegationResponse.expiration,
              )
            : undefined;
    }

    generateChallenge(): Promise<GenerateChallengeResponse> {
        return this._identityClient.generateChallenge();
    }

    initiateIdentityLink(linkToPrincipal: string): Promise<InitiateIdentityLinkResponse> {
        return this._identityClient.initiateIdentityLink(linkToPrincipal, this._isIIPrincipal);
    }

    approveIdentityLink(linkInitiatedBy: string): Promise<ApproveIdentityLinkResponse> {
        return this._identityClient.approveIdentityLink(linkInitiatedBy);
    }

    getAuthenticationPrincipals(): Promise<AuthenticationPrincipalsResponse> {
        return this._identityClient.getAuthenticationPrincipals();
    }

    private async getDelegation(
        userKey: Uint8Array,
        sessionKey: SignIdentity,
        sessionKeyDer: Uint8Array,
        expiration: bigint,
    ): Promise<DelegationIdentity | undefined> {
        const getDelegationResponse = await this._identityClient.getDelegation(
            sessionKeyDer,
            expiration,
        );

        if (getDelegationResponse.kind !== "success") {
            return undefined;
        }

        return buildDelegationIdentity(
            userKey,
            sessionKey,
            getDelegationResponse.delegation,
            getDelegationResponse.signature,
        );
    }
}
