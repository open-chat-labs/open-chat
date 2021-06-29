import type { UpdateUsernameResponse, GetCurrentUserResponse } from "../../domain/user";
import type {
    ApiGetCurrentUserResponse,
    ApiUpdateUsernameResponse,
} from "api-canisters/user_index/canister";

export function getCurrentUserResponse(candid: ApiGetCurrentUserResponse): GetCurrentUserResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            user: {
                userId: candid.Success.id,
                username: candid.Success.username,
                version: candid.Success.version,
                accountBalance: candid.Success.account_balance,
            },
        };
    }
    if ("UserNotFound" in candid) {
        return {
            kind: "unknown",
        };
    }
    throw new Error(`Unknown UserIndex.GetCurrentUserResponse of ${candid}`);
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
