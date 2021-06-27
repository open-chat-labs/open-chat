import type { CreateUserResponse, GetCurrentUserResponse } from "../../domain/user";
import type {
    ApiGetCurrentUserResponse,
    ApiCreateUserResponse,
} from "api-canisters/user_index/canister";

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

export function createUserResponse(candid: ApiCreateUserResponse): CreateUserResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            canisterId: candid.Success.canister,
        };
    }
    if ("UserLimitReached" in candid) {
        return {
            kind: "user_limit_reached",
        };
    }
    if ("UserExists" in candid) {
        return {
            kind: "user_exists",
        };
    }
    throw new Error(`Unknown UserIndex.CreateUserResponse of ${candid}`);
}
