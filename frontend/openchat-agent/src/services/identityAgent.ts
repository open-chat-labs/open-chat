import { IdentityClient } from "./identity/identity.client";
import type { DerEncodedPublicKey, Identity, SignIdentity } from "@dfinity/agent";
import { DelegationChain, DelegationIdentity } from "@dfinity/identity";
import type {
    ChallengeAttempt,
    CheckAuthPrincipalResponse,
    CreateOpenChatIdentityError,
    MigrateLegacyPrincipalResponse,
} from "openchat-shared";

export class IdentityAgent {
    private _identityClient: IdentityClient;

    constructor(identity: Identity, identityCanister: string, icUrl: string) {
        this._identityClient = IdentityClient.create(identity, identityCanister, icUrl);
    }

    checkAuthPrincipal(): Promise<CheckAuthPrincipalResponse> {
        return this._identityClient.checkAuthPrincipal();
    }

    migrateLegacyPrincipal(): Promise<MigrateLegacyPrincipalResponse> {
        return this._identityClient.migrateLegacyPrincipal();
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
            return this.getDelegation(
                createIdentityResponse.userKey,
                sessionKey,
                sessionKeyDer,
                createIdentityResponse.expiration,
            );
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

        const delegations = [
            {
                delegation: getDelegationResponse.delegation,
                signature: getDelegationResponse.signature,
            },
        ];

        const delegationChain = DelegationChain.fromDelegations(
            delegations,
            userKey.buffer as DerEncodedPublicKey,
        );

        return DelegationIdentity.fromDelegation(sessionKey, delegationChain);
    }
}

function toDer(key: SignIdentity): Uint8Array {
    return new Uint8Array(key.getPublicKey().toDer() as ArrayBuffer);
}
