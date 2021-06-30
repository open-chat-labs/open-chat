import type { UpdateUsernameResponse, GetCurrentUserResponse } from "../../domain/user";
import type {
    ApiGetCurrentUserResponse,
    ApiUpdateUsernameResponse,
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

export function updateUsernameResponse(candid: ApiUpdateUsernameResponse): UpdateUsernameResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("SuccessNoChange" in candid) {
        return "no_change";
    }
    if ("UsernameTaken" in candid) {
        return "username_taken";
    }
    if ("UserNotFound" in candid) {
        return "user_not_found";
    }
    if ("UsernameTooShort" in candid) {
        return "username_too_short";
    }
    if ("UsernameTooLong" in candid) {
        return "username_too_long";
    }
    throw new Error(`Unknown UserIndex.UpdateUsernameResponse of ${candid}`);
}
