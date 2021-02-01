export const UPDATE_MINUTES_SINCE_LAST_ONLINE = "UPDATE_MINUTES_SINCE_LAST_ONLINE";

export default function() : UpdateMinutesSinceLastOnline {
    return {
        type: UPDATE_MINUTES_SINCE_LAST_ONLINE
    };
}

export type UpdateMinutesSinceLastOnline = {
    type: typeof UPDATE_MINUTES_SINCE_LAST_ONLINE
}
