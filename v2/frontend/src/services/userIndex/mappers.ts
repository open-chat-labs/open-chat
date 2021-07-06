import type {
    SetUsernameResponse,
    CurrentUserResponse,
    SubmitPhoneNumberResponse,
    ConfirmPhoneNumberResponse,
    PhoneNumber,
    ResendCodeResponse,
    UsersResponse,
    UserSummary,
} from "../../domain/user";
import type {
    ApiConfirmPhoneNumberResponse,
    ApiCurrentUserResponse,
    ApiPhoneNumber,
    ApiResendCodeResponse,
    ApiSetUsernameResponse,
    ApiSubmitPhoneNumberResponse,
    ApiUsersResponse,
    ApiUserSummary,
} from "api-canisters/user_index/src/canister/app/idl";

export function usersResponse(candid: ApiUsersResponse): UsersResponse {
    if ("Success" in candid) {
        return {
            timestamp: candid.Success.timestamp,
            users: candid.Success.users.map(userSummary),
        };
    }
    throw new Error(`Unknown UserIndex.UsersResponse of ${candid}`);
}

export function userSummary(candid: ApiUserSummary): UserSummary {
    return {
        userId: candid.user_id.toString(),
        username: candid.username,
        secondsSinceLastOnline: candid.seconds_since_last_online,
    };
}

export function submitPhoneNumberResponse(
    candid: ApiSubmitPhoneNumberResponse
): SubmitPhoneNumberResponse {
    if ("Success" in candid) {
        return { kind: "success" };
    }
    if ("AlreadyRegistered" in candid) {
        return { kind: "already_registered" };
    }
    if ("AlreadyRegisteredByOther" in candid) {
        return { kind: "already_registered_by_other" };
    }
    if ("InvalidPhoneNumber" in candid) {
        return { kind: "invalid_phone_number" };
    }

    throw new Error(`Unknown UserIndex.SubmitPhoneNumberResponse of ${candid}`);
}

export function confirmPhoneNumber(
    candid: ApiConfirmPhoneNumberResponse
): ConfirmPhoneNumberResponse {
    if ("Success" in candid) return "success";
    if ("NotFound" in candid) return "not_found";
    if ("AlreadyClaimed" in candid) return "already_claimed";
    if ("ConfirmationCodeExpired" in candid) return "code_expired";
    if ("ConfirmationCodeIncorrect" in candid) return "code_incorrect";

    throw new Error(`Unknown UserIndex.ConfirmPhoneNumberResponse of ${candid}`);
}

export function phoneNumber(candid: ApiPhoneNumber): PhoneNumber {
    return {
        countryCode: candid.country_code,
        number: candid.number,
    };
}

export function currentUserResponse(candid: ApiCurrentUserResponse): CurrentUserResponse {
    if ("UpgradeInProgress" in candid) {
        return {
            kind: "upgrade_in_progress",
        };
    }
    if ("Unconfirmed" in candid) {
        return {
            kind: "unconfirmed_user",
            phoneNumber: phoneNumber(candid.Unconfirmed.phone_number),
        };
    }

    if ("Confirmed" in candid) {
        return {
            kind: "confirmed_user",
            canisterCreationStatus:
                "InProgress" in candid.Confirmed.canister_creation_status
                    ? "in_progress"
                    : "pending",
            username: candid.Confirmed.username,
        };
    }

    if ("ConfirmedPendingUsername" in candid) {
        return {
            kind: "confirmed_pending_username",
            canisterCreationStatus:
                "InProgress" in candid.ConfirmedPendingUsername.canister_creation_status
                    ? "in_progress"
                    : "Created" in candid.ConfirmedPendingUsername.canister_creation_status
                    ? "created"
                    : "pending",
        };
    }

    if ("Created" in candid) {
        return {
            kind: "created_user",
            userId: candid.Created.user_id,
            username: candid.Created.username,
            accountBalance: candid.Created.account_balance,
            upgradeRequired: candid.Created.upgrade_required,
        };
    }

    if ("UserNotFound" in candid) {
        return { kind: "unknown_user" };
    }

    throw new Error(`Unknown UserIndex.GetCurrentUserResponse of ${candid}`);
}

export function setUsernameResponse(candid: ApiSetUsernameResponse): SetUsernameResponse {
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
    if ("UsernameInvalid" in candid) {
        return "username_invalid";
    }
    throw new Error(`Unknown UserIndex.SetUsernameResponse of ${candid}`);
}

export function resendCodeResponse(candid: ApiResendCodeResponse): ResendCodeResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("AlreadyClaimed" in candid) {
        return "already_claimed";
    }
    if ("UserNotFound" in candid) {
        return "user_not_found";
    }
    throw new Error(`Unknown UserIndex.ResendCodeResponse of ${candid}`);
}
