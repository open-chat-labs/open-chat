import type { Identity } from "@dfinity/agent";
import { AuthClient, IdbStorage } from "@dfinity/auth-client";
import type { DelegationChain } from "@dfinity/identity";
import type { Principal } from "@dfinity/principal";
import type { SignedDelegation } from "../services/user/candid/types";

const auth = AuthClient.create({
    idleOptions: {
        disableIdle: true,
    },
    storage: new IdbStorage(),
});

export function getIdentity(): Promise<Identity | undefined> {
    return auth.then((a) => {
        const id = a.getIdentity();
        const p = id.getPrincipal();
        if (p.isAnonymous()) {
            return undefined;
        }
        return id;
    });
}

export function getPrincipal(): Promise<Principal> {
    return auth.then((a) => {
        return a.getIdentity().getPrincipal();
    });
}

export function signedDelegation(chain: DelegationChain): SignedDelegation {
    const delegation = chain.delegations[0];
    return {
        signature: new Uint8Array(delegation.signature),
        delegation: {
            pubkey: new Uint8Array(delegation.delegation.pubkey),
            expiration: delegation.delegation.expiration,
        },
    };
}
