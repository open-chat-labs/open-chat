import { IdentityClient } from "./identity/identity.client";
import type { Identity, SignIdentity } from "@dfinity/agent";
import { DelegationIdentity } from "@dfinity/identity";
import type {
    ApproveIdentityLinkResponse,
    ChallengeAttempt,
    CreateOpenChatIdentityError,
    GenerateChallengeResponse,
    InitiateIdentityLinkResponse,
} from "openchat-shared";
import { buildDelegationIdentity, toDer } from "openchat-shared";

export class IdentityAgent {
    private _identityClient: IdentityClient;

    constructor(identity: Identity, identityCanister: string, icUrl: string) {
        this._identityClient = IdentityClient.create(identity, identityCanister, icUrl);
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
        const prepareDelegationResponse =
            await this._identityClient.prepareDelegation(sessionKeyDer);

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
        return this._identityClient.initiateIdentityLink(linkToPrincipal);
    }

    approveIdentityLink(linkInitiatedBy: string): Promise<ApproveIdentityLinkResponse> {
        return this._identityClient.approveIdentityLink(linkInitiatedBy);
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
