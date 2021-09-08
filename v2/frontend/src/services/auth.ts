import type { Identity } from "@dfinity/agent";
import { PrivICClient } from "../utils/auth";
import { DelegationIdentity } from "@dfinity/identity";

const ONE_MINUTE_MILLIS = 60 * 1000;

// Use your local .env file to direct this to the local IC replica
const IDENTITY_URL = process.env.INTERNET_IDENTITY_URL || "https://identity.ic0.app";

const privicClient = PrivICClient.create();

export function getIdentity(): Promise<Identity> {
    return privicClient.then((c) => {
        console.log("Principal", c.getIdentity().getPrincipal().toText());
        return c.getIdentity();
    });
}

export function isAuthenticated(): Promise<boolean> {
    return privicClient.then((c) => c.isAuthenticated());
}

export function login(): Promise<Identity> {
    return privicClient.then((c) => {
        return new Promise((resolve, reject) => {
            c.login({
                // identityProvider: addDataRequirements(IDENTITY_URL),
                identityProvider: IDENTITY_URL,
                onSuccess: (resp) => {
                    console.log("received data from privic", resp);
                    console.log("Principal", c.getIdentity().getPrincipal().toText());
                    resolve(c.getIdentity());
                },
                onError: (err) => reject(err),
                dataRequest: {
                    phone: "exists",
                },
            });
        });
    });
}

export function logout(): Promise<void> {
    return privicClient.then((c) => c.logout());
}

export function startSession(identity: Identity): Promise<void> {
    return new Promise((resolve) => {
        const durationUntilSessionExpireMS = getTimeUntilSessionExpiryMs(identity);
        const durationUntilLogoutMs = durationUntilSessionExpireMS - ONE_MINUTE_MILLIS;
        if (durationUntilLogoutMs <= 5 * ONE_MINUTE_MILLIS) {
            resolve();
        } else {
            setTimeout(resolve, durationUntilLogoutMs);
        }
        // setTimeout(resolve, 5000);
    });
}

export function getTimeUntilSessionExpiryMs(identity: Identity): number {
    if (!(identity instanceof DelegationIdentity)) {
        return 0;
    }

    const expiryDateTimestampMs = Number(
        identity
            .getDelegation()
            .delegations.map((d) => d.delegation.expiration)
            .reduce((current, next) => (next < current ? next : current)) / BigInt(1_000_000)
    );

    return expiryDateTimestampMs - Date.now();
}
