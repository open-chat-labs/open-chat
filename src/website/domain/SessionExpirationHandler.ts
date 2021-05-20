import { DelegationIdentity } from "@dfinity/identity";

const ONE_MINUTE_MILLIS = 60 * 1000;

class SessionExpirationHandler {
    private identity?: DelegationIdentity;
    private timeout?: NodeJS.Timeout;

    public startSession = (identity: DelegationIdentity, logout: () => void) => {
        this.reset()
        this.identity = identity;

        const logoutAndReset = () => {
            logout();
            this.reset();
        }

        this.handleSessionExpiry(identity, logoutAndReset);
    }

    private handleSessionExpiry = (identity: DelegationIdentity, logoutAndReset: () => void) => {
        const durationUntilSessionExpiresMs = this.getTimeUntilSessionExpiryMs(identity);

        if (durationUntilSessionExpiresMs) {
            const durationUntilLogoutMs = durationUntilSessionExpiresMs - ONE_MINUTE_MILLIS;

            // If when the session starts there is < 5 minutes remaining, log the user out now and force them to renew
            // their session
            if (durationUntilLogoutMs <= 5 * ONE_MINUTE_MILLIS) {
                logoutAndReset();
            } else {
                // Log the user out 1 minute before their session expires
                this.timeout = setTimeout(() => logoutAndReset(), durationUntilLogoutMs);
            }
        }
    }

    private getTimeUntilSessionExpiryMs = (identity: DelegationIdentity) : number => {
        const expiryDateTimestampMs = Number(identity.getDelegation().delegations
            .map(d => d.delegation.expiration)
            .reduce((current, next) => next < current ? next : current) / BigInt(1_000_000));

        return expiryDateTimestampMs - Date.now();
    }

    private reset = () => {
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = undefined;
        }
        this.identity = undefined;
    }
}

const handler = new SessionExpirationHandler();

export default handler;
