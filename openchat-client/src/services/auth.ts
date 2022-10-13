import type { Identity } from "@dfinity/agent";
import { AuthClient } from "@dfinity/auth-client";
import { DelegationIdentity } from "@dfinity/identity";
import { unregister } from "../utils/notifications";
import { initialiseTracking, startTrackingSession } from "../utils/tracking";
import { AuthProvider } from "../domain/auth";
import { idbAuthClientStore } from "../stores/authProviders";
const SESSION_TIMEOUT_NANOS = BigInt(30 * 24 * 60 * 60 * 1000 * 1000 * 1000); // 30 days
const ONE_MINUTE_MILLIS = 60 * 1000;
const MAX_TIMEOUT_MS = Math.pow(2, 31) - 1;

localStorage.removeItem("ic-delegation");
localStorage.removeItem("ic-identity");

const authClient = AuthClient.create({
    idleOptions: {
        disableIdle: true,
    },
    storage: idbAuthClientStore,
});

initialiseTracking();

export function getIdentity(): Promise<Identity> {
    return authClient.then((c) => c.getIdentity());
}

export function isAuthenticated(): Promise<boolean> {
    return authClient.then((c) => c.isAuthenticated());
}

export function login(authProvider: AuthProvider): Promise<Identity> {
    return authClient.then((c) => {
        return new Promise((resolve, reject) => {
            c.login({
                identityProvider: buildAuthProviderUrl(authProvider),
                maxTimeToLive: SESSION_TIMEOUT_NANOS,
                derivationOrigin: process.env.II_DERIVATION_ORIGIN,
                //windowOpenerFeatures: buildWindowOpenerFeatures(authProvider),
                onSuccess: () => resolve(c.getIdentity()),
                onError: (err) => reject(err),
            });
        });
    });
}

function buildWindowOpenerFeatures(authProvider: AuthProvider): string {
    const isII = authProvider === AuthProvider.II;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const width = Math.min(screenWidth, isII ? 525 : 465);
    const height = Math.min(screenHeight, isII ? 800 : 705);
    const left = (screenWidth - width) / 2;
    const top = (screenHeight - height) / 2;

    return `popup=1,toolbar=0,location=0,menubar=0,width=${width},height=${height},left=${left},top=${top}`;
}

function buildAuthProviderUrl(authProvider: AuthProvider): string | undefined {
    if (authProvider === AuthProvider.II) {
        return process.env.INTERNET_IDENTITY_URL;
    } else {
        return (
            process.env.NFID_URL +
            "&applicationLogo=" +
            encodeURIComponent("https://oc.app/apple-touch-icon.png") +
            "#authorize"
        );
    }
}

export async function logout(): Promise<void> {
    await unregister();
    return authClient.then((c) => {
        c.logout().then(() => window.location.reload());
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
            setTimeout(timeout, Math.min(MAX_TIMEOUT_MS, durationUntilLogoutMs));
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
