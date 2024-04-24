import { type Delegation, DelegationChain, DelegationIdentity } from "@dfinity/identity";
import { type DerEncodedPublicKey, type Signature, SignIdentity } from "@dfinity/agent";

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

    const delegationChain = DelegationChain.fromDelegations(
        delegations,
        userKey.buffer as DerEncodedPublicKey,
    );

    return DelegationIdentity.fromDelegation(sessionKey, delegationChain);
}

export function toDer(key: SignIdentity): Uint8Array {
    return new Uint8Array(key.getPublicKey().toDer() as ArrayBuffer);
}
