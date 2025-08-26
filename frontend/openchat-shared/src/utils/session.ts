import type { Identity } from "@icp-sdk/core/agent";
import type { DelegationIdentity } from "@icp-sdk/core/identity";

export function getTimeUntilSessionExpiryMs(identity: Identity): number {
    if (!("getDelegation" in identity)) {
        return 0;
    }

    const expiryDateTimestampMs = Number(
        (identity as DelegationIdentity)
            .getDelegation()
            .delegations.map((d) => d.delegation.expiration)
            .reduce((current, next) => (next < current ? next : current)) / BigInt(1_000_000),
    );

    return expiryDateTimestampMs - Date.now();
}
