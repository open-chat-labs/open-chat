import type { GetCurrentUserResponse } from "../../domain/user";
import type { ApiGetCurrentUserResponse } from "api-canisters/user_index/canister";

export function getCurrentUserResponse(_candid: ApiGetCurrentUserResponse): GetCurrentUserResponse {
    // return {
    //     kind: "success",
    //     user: {
    //         username: "julian_jelfs",
    //     },
    // };
    return {
        kind: "unknown",
    };
}
