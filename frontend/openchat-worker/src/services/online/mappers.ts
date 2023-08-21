import type { ApiLastOnlineResponse } from "./candid/idl";

export function lastOnlineResponse(
    candid: ApiLastOnlineResponse
): Record<string, number> {
    const now = Date.now();
    return candid.Success.reduce((res, next) => {
        res[next.user_id.toString()] = now - Number(next.duration_since_last_online);
        return res;
    } , {} as Record<string, number>);
}
