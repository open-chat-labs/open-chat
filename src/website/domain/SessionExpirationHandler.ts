import { DelegationIdentity } from "@dfinity/identity";
import notifySessionExpired from "../actions/signin/notifySessionExpired";
import store from "../store";
import getAuthClient from "../utils/authClient";

const ONE_MINUTE_MILLIS = 60 * 1000;

class SessionExpirationHandler {
    private identity?: DelegationIdentity;
    private timeout?: NodeJS.Timeout;

    public startSession = (identity: DelegationIdentity) => {
        this.reset()
        this.identity = identity;

        this.handleSessionExpiry(identity);
    }

    private handleSessionExpiry = (identity: DelegationIdentity) => {
        const durationUntilSessionExpiresMs = this.getTimeUntilSessionExpiryMs(identity);

        if (durationUntilSessionExpiresMs) {
            const durationUntilLogoutMs = durationUntilSessionExpiresMs - ONE_MINUTE_MILLIS;

            // If when the session starts there is < 5 minutes remaining, log the user out now and force them to renew
            // their session
            if (durationUntilLogoutMs <= 5 * ONE_MINUTE_MILLIS) {
                this.logoutAndReset();
            } else {
                // Log the user out 1 minute before their session expires
                this.timeout = setTimeout(() => this.logoutAndReset(), durationUntilLogoutMs);
            }
        }
    }

    private getTimeUntilSessionExpiryMs = (identity: DelegationIdentity) : number => {
        const expiryDateTimestampMs = Number(identity.getDelegation().delegations
            .map(d => d.delegation.expiration)
            .reduce((current, next) => next < current ? next : current) / BigInt(1_000_000));

        return expiryDateTimestampMs - Date.now();
    }

    private logoutAndReset = async () : Promise<void> => {
        await (store.dispatch(notifySessionExpired() as any) as Promise<void>);
        await getAuthClient().logout();
        this.reset();
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
