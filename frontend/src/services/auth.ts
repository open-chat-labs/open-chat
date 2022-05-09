import type { Identity } from "@dfinity/agent";
import { AuthClient } from "@dfinity/auth-client";
import { DelegationIdentity } from "@dfinity/identity";
import { unregister } from "../utils/notifications";
import { closeDb } from "../utils/caching";
import { initialiseTracking, startTrackingSession, endTrackingSession } from "../utils/tracking";

const SESSION_TIMEOUT_NANOS = BigInt(30 * 24 * 60 * 60 * 1000 * 1000 * 1000); // 30 days
const ONE_MINUTE_MILLIS = 60 * 1000;

// const isProd = process.env.NODE_ENV === "production";
const isProd = true;

// Use your local .env file to direct this to the local IC replica
const IDENTITY_URL = process.env.INTERNET_IDENTITY_URL || "https://identity.ic0.app";

const authClient = AuthClient.create();

initialiseTracking();

export function getIdentity(): Promise<Identity> {
    return authClient.then((c) => c.getIdentity());
}

export function isAuthenticated(): Promise<boolean> {
    return authClient.then((c) => c.isAuthenticated());
}

export function login(): Promise<Identity> {
    return authClient.then((c) => {
        return new Promise((resolve, reject) => {
            c.login({
                identityProvider: IDENTITY_URL,
                maxTimeToLive: SESSION_TIMEOUT_NANOS,
                onSuccess: () => resolve(c.getIdentity()),
                onError: (err) => reject(err),
            });
        });
    });
}

export async function logout(): Promise<void> {
    await unregister();
    return authClient.then((c) => {
        c.logout();
        endTrackingSession();
        closeDb();
    });
}

export function startSession(identity: Identity): Promise<void> {
    startTrackingSession(identity);

    return new Promise((resolve) => {
        const durationUntilSessionExpireMS = getTimeUntilSessionExpiryMs(identity);
        const durationUntilLogoutMs = durationUntilSessionExpireMS - ONE_MINUTE_MILLIS;
        function timeout() {
            logout().then(resolve);
        }
        if (durationUntilLogoutMs <= 5 * ONE_MINUTE_MILLIS) {
            timeout();
        } else {
            setTimeout(timeout, durationUntilLogoutMs);
        }
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
