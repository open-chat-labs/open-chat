import { AuthClient } from "@dfinity/auth-client";
import { DelegationIdentity } from "@dfinity/identity";
import { Option } from "../domain/model/common";

let authClient: Option<AuthClient>;

export const init = async () => {
    if (!authClient) {
        authClient = await AuthClient.create();
    }
}

const getAuthClient = () : AuthClient => authClient!;

export default getAuthClient;

export function getTimeUntilSessionExpiryMs() : number {
    const identity = authClient?.getIdentity();
    if (!(identity instanceof DelegationIdentity)) {
        return 0;
    }

    const expiryDateTimestampMs = Number(identity.getDelegation().delegations
        .map(d => d.delegation.expiration)
        .reduce((current, next) => next < current ? next : current) / BigInt(1_000_000));

    return expiryDateTimestampMs - Date.now();
}
