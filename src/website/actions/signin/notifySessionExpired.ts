import { Dispatch } from "react";
import getAuthClient from "../../utils/authClient";

export const SESSION_EXPIRED = "SESSION_EXPIRED";
export const SESSION_EXPIRY_ACKNOWLEDGED = "SESSION_EXPIRY_ACKNOWLEDGED";

export default function notifySessionExpired() {
    return async (dispatch: Dispatch<any>) => {
        await getAuthClient().logout();

        const sessionExpiredEvent: SessionExpiredEvent = {
            type: SESSION_EXPIRED
        };

        dispatch(sessionExpiredEvent);
    };
}

export function sessionExpiryAcknowledged() : SessionExpiryAcknowledgedEvent {
    return {
        type: SESSION_EXPIRY_ACKNOWLEDGED
    };
}

export type SessionExpiredEvent = {
    type: typeof SESSION_EXPIRED
}

export type SessionExpiryAcknowledgedEvent = {
    type: typeof SESSION_EXPIRY_ACKNOWLEDGED
}
