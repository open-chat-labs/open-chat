import type {
    UpdateUsernameResponse,
    GetCurrentUserResponse,
    RegisterPhoneNumberResponse,
    ConfirmPhoneNumberResponse,
} from "../../domain/user";
import type {
    ApiConfirmPhoneNumberResponse,
    ApiGetCurrentUserResponse,
    ApiRegisterPhoneNumberResponse,
    ApiUpdateUsernameResponse,
} from "api-canisters/user_index/canister";

export function registerPhoneNumberResponse(
    candid: ApiRegisterPhoneNumberResponse
): RegisterPhoneNumberResponse {
    if ("Success" in candid) {
        return { kind: "success" };
    }
    if ("AlreadyRegistered" in candid) {
        return { kind: "already_registered" };
    }
    if ("AlreadyRegisteredByOther" in candid) {
        return { kind: "already_registered_by_other" };
    }
    if ("AlreadyRegisteredButUnclaimed" in candid) {
        return { kind: "already_registered_but_unclaimed" };
    }
    if ("InvalidPhoneNumber" in candid) {
        return { kind: "invalid_phone_number" };
    }

    throw new Error(`Unknown UserIndex.RegisterPhoneNumberResponse of ${candid}`);
}

export function confirmPhoneNumber(
    candid: ApiConfirmPhoneNumberResponse
): ConfirmPhoneNumberResponse {
    if ("Success" in candid)
        return {
            kind: "success",
            canisterId: candid.Success.canister_id,
        };

    if ("NotFound" in candid) {
        return { kind: "not_found" };
    }
    if ("AlreadyClaimed" in candid) {
        return { kind: "already_claimed" };
    }
    if ("ConfirmationCodeExpired" in candid) {
        return { kind: "code_expired" };
    }
    if ("ConfirmationCodeIncorrect" in candid) {
        return { kind: "code_incorrect" };
    }

    throw new Error(`Unknown PhoneIndex.ClaimResponse of ${candid}`);
}

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
        return { kind: "unknown" };
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
