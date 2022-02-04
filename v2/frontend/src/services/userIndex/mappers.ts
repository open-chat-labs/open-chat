import type {
    SetUsernameResponse,
    CurrentUserResponse,
    SubmitPhoneNumberResponse,
    ConfirmPhoneNumberResponse,
    PhoneNumber,
    ResendCodeResponse,
    UsersResponse,
    UserSummary,
    PartialUserSummary,
    CreateCanisterResponse,
    RegisterUserResponse,
    PhoneStatus,
    UpgradeStorageResponse,
} from "../../domain/user/user";
import type {
    ApiConfirmPhoneNumberResponse,
    ApiCreateCanisterResponse,
    ApiCurrentUserResponse,
    ApiPartialUserSummary,
    ApiPhoneNumber,
    ApiPhoneStatus,
    ApiRegisterUserResponse,
    ApiResendCodeResponse,
    ApiSearchResponse,
    ApiSetUsernameResponse,
    ApiSubmitPhoneNumberResponse,
    ApiUpgradeStorageResponse,
    ApiUsersResponse,
    ApiUserSummary,
} from "./candid/idl";
import { bytesToHexString, identity, optional } from "../../utils/mapping";
import { UnsupportedValueError } from "../../utils/error";
import { Version } from "../../domain/version";

export function userSearchResponse(candid: ApiSearchResponse): UserSummary[] {
    if ("Success" in candid) {
        const timestamp = candid.Success.timestamp;
        return candid.Success.users.map((u) => userSummary(u, timestamp));
    }
    throw new Error(`Unknown UserIndex.SearchResponse of ${candid}`);
}

export function usersResponse(candid: ApiUsersResponse): UsersResponse {
    if ("Success" in candid) {
        const timestamp = candid.Success.timestamp;
        return {
            timestamp,
            users: candid.Success.users.map((u) => partialUserSummary(u, timestamp)),
        };
    }
    throw new Error(`Unknown UserIndex.UsersResponse of ${candid}`);
}

export function partialUserSummary(
    candid: ApiPartialUserSummary,
    timestamp: bigint
): PartialUserSummary {
    return {
        userId: candid.user_id.toString(),
        username: optional(candid.username, identity),
        blobReference: optional(candid.avatar_id, (id) => ({
            blobId: id,
            canisterId: candid.user_id.toString(),
        })),
        lastOnline: Date.now() - candid.seconds_since_last_online * 1000,
        updated: timestamp,
    };
}

export function userSummary(candid: ApiUserSummary, timestamp: bigint): UserSummary {
    return {
        userId: candid.user_id.toString(),
        username: candid.username,
        lastOnline: Date.now() - candid.seconds_since_last_online * 1000,
        blobReference: optional(candid.avatar_id, (id) => ({
            blobId: id,
            canisterId: candid.user_id.toString(),
        })),
        updated: timestamp,
    };
}

export function submitPhoneNumberResponse(
    candid: ApiSubmitPhoneNumberResponse
): SubmitPhoneNumberResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("AlreadyRegistered" in candid) {
        return "already_registered";
    }
    if ("AlreadyRegisteredByOther" in candid) {
        return "already_registered_by_other";
    }
    if ("InvalidPhoneNumber" in candid) {
        return "invalid_phone_number";
    }
    if ("UserNotFound" in candid) {
        return "user_not_found";
    }
    throw new UnsupportedValueError(
        "Unexpected ApiSubmitPhoneNumberResponse type received",
        candid
    );
}

export function registerUserResponse(candid: ApiRegisterUserResponse): RegisterUserResponse {
    if ("UsernameTaken" in candid) {
        return "username_taken";
    }
    if ("UsernameTooShort" in candid) {
        return "username_too_short";
    }
    if ("UsernameInvalid" in candid) {
        return "username_invalid";
    }
    if ("AlreadyRegistered" in candid) {
        return "already_registered";
    }
    if ("UserLimitReached" in candid) {
        return "user_limit_reached";
    }
    if ("UsernameTooLong" in candid) {
        return "username_too_long";
    }
    if ("Success" in candid) {
        return "success";
    }
    if ("NotSupported" in candid) {
        return "not_supported";
    }
    if ("InternalError" in candid) {
        return "internal_error";
    }
    if ("CyclesBalanceTooLow" in candid) {
        return "cycles_balance_too_low";
    }

    throw new UnsupportedValueError("Unexpected ApiRegisterUserResponse type received", candid);
}

export function confirmPhoneNumber(
    candid: ApiConfirmPhoneNumberResponse
): ConfirmPhoneNumberResponse {
    if ("Success" in candid)
        return {
            kind: "success",
            storageLimitBytes: Number(candid.Success.open_storage_limit_bytes),
        };
    if ("UserNotFound" in candid) return { kind: "not_found" };
    if ("AlreadyClaimed" in candid) return { kind: "already_claimed" };
    if ("ConfirmationCodeExpired" in candid) return { kind: "code_expired" };
    if ("ConfirmationCodeIncorrect" in candid) return { kind: "code_incorrect" };
    if ("PhoneNumberNotSubmitted" in candid) {
        return { kind: "phone_number_not_submitted" };
    }

    throw new UnsupportedValueError(
        "Unexpected ApiConfirmPhoneNumberResponse type received",
        candid
    );
}

export function phoneNumber(candid: ApiPhoneNumber): PhoneNumber {
    return {
        countryCode: candid.country_code,
        number: candid.number,
    };
}

export function createCanisterResponse(candid: ApiCreateCanisterResponse): CreateCanisterResponse {
    if ("Success" in candid) return "success";
    if ("UserAlreadyCreated" in candid) return "user_already_created";
    if ("CreationInProgress" in candid) return "creation_in_progress";
    if ("InternalError" in candid) return "internal_error";
    if ("UserNotFound" in candid) return "user_not_found";
    if ("CyclesBalanceTooLow" in candid) return "cycles_balance_too_low";

    throw new UnsupportedValueError("Unexpected ApiCreateCanisterResponse type received", candid);
}

export function upgradeStorageResponse(candid: ApiUpgradeStorageResponse): UpgradeStorageResponse {
    if ("SuccessNoChange" in candid) {
        return { kind: "success_no_change" };
    }
    if ("Success" in candid) {
        return {
            kind: "success",
        };
    }
    if ("PaymentNotFound" in candid) {
        return { kind: "payment_not_found" };
    }
    if ("PaymentInsufficient" in candid) {
        return {
            kind: "payment_insufficient",
            accountBalancee8s: Number(candid.PaymentInsufficient.account_balance.e8s),
            ammountRequirede8s: Number(candid.PaymentInsufficient.amount_required.e8s),
        };
    }
    if ("InternalError" in candid) {
        return { kind: "internal_error" };
    }
    if ("StorageLimitExceeded" in candid) {
        return { kind: "storage_limit_exceeded" };
    }
    if ("UserNotFound" in candid) {
        return { kind: "user_not_found" };
    }
    throw new UnsupportedValueError("Unexpected ApiUpgradeStorageResponse type received", candid);
}

export function currentUserResponse(candid: ApiCurrentUserResponse): CurrentUserResponse {
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

    if ("Created" in candid) {
        const version = candid.Created.wasm_version;
        console.log("User: ", candid.Created);
        return {
            kind: "created_user",
            userId: candid.Created.user_id.toString(),
            username: candid.Created.username,
            icpAccount: bytesToHexString(candid.Created.icp_account),
            phoneStatus: phoneStatus(candid.Created.phone_status),
            canisterUpgradeStatus:
                "Required" in candid.Created.canister_upgrade_status
                    ? "required"
                    : "NotRequired" in candid.Created.canister_upgrade_status
                    ? "not_required"
                    : "in_progress",
            wasmVersion: new Version(version.major, version.minor, version.patch),
            openStorageLimitBytes: Number(candid.Created.open_storage_limit_bytes),
        };
    }

    if ("UserNotFound" in candid) {
        return { kind: "unknown_user" };
    }

    throw new Error(`Unexpected ApiCurrentUserResponse type received: ${candid}`);
    // throw new UnsupportedValueError("Unexpected ApiCurrentUserResponse type received", candid);
}

export function phoneStatus(candid: ApiPhoneStatus): PhoneStatus {
    if ("Unconfirmed" in candid) {
        return {
            kind: "unconfirmed",
            validUntil: Number(candid.Unconfirmed.valid_until),
            phoneNumber: phoneNumber(candid.Unconfirmed.phone_number),
        };
    }
    if ("None" in candid) {
        return { kind: "none" };
    }
    if ("Confirmed" in candid) {
        return { kind: "confirmed" };
    }
    throw new UnsupportedValueError("Unexpected ApiPhoneStatus type received", candid);
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
    if ("UserUnconfirmed" in candid) {
        return "user_unconfirmed";
    }
    throw new UnsupportedValueError("Unexpected ApiSetUsernameResponse type received", candid);
}

export function resendCodeResponse(candid: ApiResendCodeResponse): ResendCodeResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("PhoneNumberAlreadyConfirmed" in candid) {
        return "phone_number_already_confirmed";
    }
    if ("UserNotFound" in candid) {
        return "user_not_found";
    }
    if ("PhoneNumberNotSubmitted" in candid) {
        return "phone_number_not_submitted";
    }
    throw new UnsupportedValueError("Unexpected ApiResendCodeResponse type received", candid);
}
