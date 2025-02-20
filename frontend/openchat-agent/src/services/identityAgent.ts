import { IdentityClient } from "./identity/identity.client";
import { HttpAgent, type Identity, type SignIdentity } from "@dfinity/agent";
import { DelegationIdentity } from "@dfinity/identity";
import type {
    ApproveIdentityLinkResponse,
    AuthenticationPrincipalsResponse,
    ChallengeAttempt,
    CheckAuthPrincipalResponse,
    CreateOpenChatIdentityError,
    GenerateChallengeResponse,
    InitiateIdentityLinkResponse,
    RemoveIdentityLinkResponse,
    WebAuthnKeyFull,
} from "openchat-shared";
import { buildDelegationIdentity, toDer } from "openchat-shared";
import { createHttpAgent } from "../utils/httpAgent";
import { getCachedWebAuthnKey } from "../utils/webAuthnKeyCache";

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

    checkAuthPrincipal(): Promise<CheckAuthPrincipalResponse> {
        return this._identityClient.checkAuthPrincipal();
    }

    async createOpenChatIdentity(
        sessionKey: SignIdentity,
        webAuthnCredentialId: Uint8Array | undefined,
        challengeAttempt: ChallengeAttempt | undefined,
    ): Promise<DelegationIdentity | CreateOpenChatIdentityError> {
        const webAuthnKey = webAuthnCredentialId !== undefined
            ? await this.hydrateWebAuthnKey(webAuthnCredentialId)
            : undefined;

        const sessionKeyDer = toDer(sessionKey);
        const createIdentityResponse = await this._identityClient.createIdentity(
            sessionKeyDer,
            webAuthnKey,
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

    async initiateIdentityLink(
        linkToPrincipal: string,
        webAuthnCredentialId: Uint8Array | undefined
    ): Promise<InitiateIdentityLinkResponse> {
        const webAuthnKey = webAuthnCredentialId !== undefined
            ? await this.hydrateWebAuthnKey(webAuthnCredentialId)
            : undefined;

        return this._identityClient.initiateIdentityLink(linkToPrincipal, webAuthnKey, this._isIIPrincipal);
    }

    approveIdentityLink(linkInitiatedBy: string): Promise<ApproveIdentityLinkResponse> {
        return this._identityClient.approveIdentityLink(linkInitiatedBy);
    }

    removeIdentityLink(linked_principal: string): Promise<RemoveIdentityLinkResponse> {
        return this._identityClient.removeIdentityLink(linked_principal);
    }

    getAuthenticationPrincipals(): Promise<AuthenticationPrincipalsResponse> {
        return this._identityClient.getAuthenticationPrincipals();
    }

    async lookupWebAuthnPubKey(credentialId: Uint8Array): Promise<Uint8Array | undefined> {
        const cached = await getCachedWebAuthnKey(credentialId);
        return cached !== undefined
            ? cached.publicKey
            : this._identityClient.lookupWebAuthnPubKey(credentialId);
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

    private async hydrateWebAuthnKey(credentialId: Uint8Array): Promise<WebAuthnKeyFull> {
        const key = await getCachedWebAuthnKey(credentialId);
        if (key === undefined) throw new Error("Failed to find WebAuthnKey details");
        return key;
    }
}
