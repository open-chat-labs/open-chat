import { type Signature, SignIdentity } from "@icp-sdk/core/agent";
import { type Delegation, DelegationChain, DelegationIdentity, ECDSAKeyIdentity } from "@icp-sdk/core/identity";
import type { JsonnableIdentityKeyAndChain } from "../domain";

export async function buildIdentityFromJson(json: JsonnableIdentityKeyAndChain): Promise<SignIdentity> {
    const key = await ECDSAKeyIdentity.fromKeyPair(json.key);
    const delegationChain = DelegationChain.fromJSON(json.delegation);

    return DelegationIdentity.fromDelegation(key, delegationChain);
}

export function buildDelegationChain(userKey: Uint8Array, delegation: Delegation, signature: Signature): DelegationChain {
    const delegations = [
        {
            delegation,
            signature,
        },
    ];

    return DelegationChain.fromDelegations(delegations, userKey);
}

export function buildDelegationIdentity(
    userKey: Uint8Array,
    sessionKey: SignIdentity,
    delegation: Delegation,
    signature: Signature,
): DelegationIdentity {
    const delegationChain = buildDelegationChain(userKey, delegation, signature);

    return DelegationIdentity.fromDelegation(sessionKey, delegationChain);
}

export function toDer(key: SignIdentity): Uint8Array {
    return key.getPublicKey().toDer();
}
