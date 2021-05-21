import notifySessionExpired from "../actions/signin/notifySessionExpired";
import store from "../store";
import { getTimeUntilSessionExpiryMs } from "../utils/authClient";

const ONE_MINUTE_MILLIS = 60 * 1000;

class SessionExpirationHandler {
    private timeout?: NodeJS.Timeout;

    public startSession = () => {
        this.reset()
        this.handleSessionExpiry();
    }

    private handleSessionExpiry = () => {
        const durationUntilSessionExpiresMs = getTimeUntilSessionExpiryMs();

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

    private logoutAndReset = async () : Promise<void> => {
        await (store.dispatch(notifySessionExpired() as any) as Promise<void>);
        this.reset();
    }

    private reset = () => {
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = undefined;
        }
    }
}

const handler = new SessionExpirationHandler();

export default handler;
