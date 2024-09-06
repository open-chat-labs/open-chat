import type { OnlineUsersLastOnlineResponse } from "../../typebox";
import { principalBytesToString } from "../../utils/mapping";

export function lastOnlineResponse(value: OnlineUsersLastOnlineResponse): Record<string, number> {
    const now = Date.now();
    return value.Success.reduce(
        (res, next) => {
            res[principalBytesToString(next.user_id)] =
                now - Number(next.duration_since_last_online);
            return res;
        },
        {} as Record<string, number>,
    );
}
