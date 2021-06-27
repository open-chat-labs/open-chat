import type { GetCurrentUserResponse } from "../../domain/user";
import type { ApiGetCurrentUserResponse } from "api-canisters/user_index/canister";

// todo - fill this out as we go along and as we know what shape out domain model actually needs to be
// don't want to just copy the downstream types blindly
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
