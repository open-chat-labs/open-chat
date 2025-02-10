import type { DelegationChain } from "@dfinity/identity";
import { SignedDelegation as TSignedDelegation } from "../typebox";

export function signedDelegation(chain: DelegationChain): TSignedDelegation {
    const delegation = chain.delegations[0];
    return {
        signature: new Uint8Array(delegation.signature),
        delegation: {
            pubkey: new Uint8Array(delegation.delegation.pubkey),
            expiration: delegation.delegation.expiration,
        },
    };
}
