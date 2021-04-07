export const SESSION_EXPIRED = "SESSION_EXPIRED";

export default function notifySessionExpired() : SessionExpiredEvent {
    return {
        type: SESSION_EXPIRED
    };
}

export type SessionExpiredEvent = {
    type: typeof SESSION_EXPIRED
}
