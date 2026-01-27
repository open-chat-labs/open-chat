import type { Identity } from "@icp-sdk/core/agent";
import type { DelegationIdentity } from "@icp-sdk/core/identity";

export function getSessionExpiryMs(identity: Identity): number {
    if (!("getDelegation" in identity)) {
        return 0;
    }

    return Number(
        (identity as DelegationIdentity)
            .getDelegation()
            .delegations.map((d) => d.delegation.expiration)
            .reduce((current, next) => (next < current ? next : current)) / BigInt(1_000_000),
    );
}
