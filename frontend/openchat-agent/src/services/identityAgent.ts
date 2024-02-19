import { IdentityClient } from "./identity/identity.client";
import type { DerEncodedPublicKey, SignIdentity } from "@dfinity/agent";
import { DelegationChain, DelegationIdentity } from "@dfinity/identity";
import type { CheckAuthPrincipalResponse, MigrateLegacyPrincipalResponse } from "openchat-shared";

export class IdentityAgent {
    private _identityClient: IdentityClient;

    constructor(
        private identity: SignIdentity,
        identityCanister: string,
        icUrl: string,
    ) {
        this._identityClient = IdentityClient.create(identity, identityCanister, icUrl);
    }

    checkAuthPrincipal(): Promise<CheckAuthPrincipalResponse> {
        return this._identityClient.checkAuthPrincipal();
    }

    migrateLegacyPrincipal(): Promise<MigrateLegacyPrincipalResponse> {
        return this._identityClient.migrateLegacyPrincipal();
    }

    async getOpenChatIdentity(sessionKey: Uint8Array): Promise<DelegationIdentity | undefined> {
        const prepareDelegationResponse = await this._identityClient.prepareDelegation(sessionKey);
        if (prepareDelegationResponse.kind === "not_found") {
            return undefined;
        }

        const getDelegationResponse = await this._identityClient.getDelegation(
            sessionKey,
            prepareDelegationResponse.expiration,
        );

        if (getDelegationResponse.kind === "not_found") {
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
            prepareDelegationResponse.userKey.buffer as DerEncodedPublicKey,
        );

        return DelegationIdentity.fromDelegation(this.identity, delegationChain);
    }
}
