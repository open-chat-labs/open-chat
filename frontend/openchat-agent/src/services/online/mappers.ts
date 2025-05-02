import type { OnlineUsersLastOnlineResponse, OnlineUsersMarkAsOnlineResponse } from "../../typebox";
import { principalBytesToString } from "../../utils/mapping";
import type { MinutesOnline } from "openchat-shared";

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

export function markAsOnlineResponse(value: OnlineUsersMarkAsOnlineResponse): MinutesOnline {
    if (typeof value === "object" && "SuccessV2" in value) {
        return {
            minutesOnlineThisMonth: value.SuccessV2.minutes_online,
            minutesOnlineLastMonth: value.SuccessV2.minutes_online_last_month,
        };
    }
    return {
        minutesOnlineThisMonth: 0,
        minutesOnlineLastMonth: 0,
    };
}
