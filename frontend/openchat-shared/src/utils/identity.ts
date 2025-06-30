import { type Delegation, DelegationChain, DelegationIdentity } from "@dfinity/identity";
import { type Signature, SignIdentity } from "@dfinity/agent";

export function buildDelegationIdentity(
    userKey: Uint8Array,
    sessionKey: SignIdentity,
    delegation: Delegation,
    signature: Signature,
): DelegationIdentity {
    const delegations = [
        {
            delegation,
            signature,
        },
    ];

    const delegationChain = DelegationChain.fromDelegations(delegations, userKey);

    return DelegationIdentity.fromDelegation(sessionKey, delegationChain);
}

export function toDer(key: SignIdentity): Uint8Array {
    return key.getPublicKey().toDer();
}
