import {
    CheckUsernameResponse,
    SetUsernameResponse,
    CurrentUserResponse,
    CreateChallengeResponse,
    SubmitPhoneNumberResponse,
    ConfirmPhoneNumberResponse,
    PhoneNumber,
    ResendCodeResponse,
    UsersResponse,
    UserSummary,
    PartialUserSummary,
    RegisterUserResponse,
    PhoneStatus,
    UpgradeStorageResponse,
    Version,
    UnsupportedValueError,
    SuspendUserResponse,
    UnsuspendUserResponse,
    SuspensionDetails,
    SuspensionAction,
} from "openchat-shared";
import type {
    ApiCheckUsernameResponse,
    ApiConfirmPhoneNumberResponse,
    ApiCreateChallengeResponse,
    ApiCurrentUserResponse,
    ApiPartialUserSummary,
    ApiPhoneNumber,
    ApiPhoneStatus,
    ApiRegisterUserResponse,
    ApiResendCodeResponse,
    ApiSearchResponse,
    ApiSetUsernameResponse,
    ApiSubmitPhoneNumberResponse,
    ApiSuspendUserResponse,
    ApiSuspensionAction,
    ApiSuspensionDetails,
    ApiUnsuspendUserResponse,
    ApiUpgradeStorageResponse,
    ApiUsersResponse,
    ApiUserSummary,
} from "./candid/idl";
import { bytesToHexString, identity, optional } from "../../utils/mapping";

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
            serverTimestamp: timestamp,
            users: candid.Success.users.map((u) => partialUserSummary(u, timestamp)),
        };
    }
    throw new Error(`Unknown UserIndex.UsersResponse of ${candid}`);
}

export function partialUserSummary(
    candid: ApiPartialUserSummary,
    timestamp: bigint
): PartialUserSummary {
    const userId = candid.user_id.toString();
    return {
        kind: candid.is_bot ? "bot" : "user",
        userId,
        username: optional(candid.username, identity),
        blobReference: optional(candid.avatar_id, (id) => ({
            blobId: id,
            canisterId: userId,
        })),
        updated: timestamp,
        suspended: candid.suspended,
        diamond: true,
    };
}

export function userSummary(candid: ApiUserSummary, timestamp: bigint): UserSummary {
    return {
        kind: candid.is_bot ? "bot" : "user",
        userId: candid.user_id.toString(),
        username: candid.username,
        blobReference: optional(candid.avatar_id, (id) => ({
            blobId: id,
            canisterId: candid.user_id.toString(),
        })),
        updated: timestamp,
        suspended: candid.suspended,
        diamond: true,
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

export function createChallengeResponse(
    candid: ApiCreateChallengeResponse
): CreateChallengeResponse {
    if ("Throttled" in candid) {
        return { kind: "throttled" };
    }
    if ("Success" in candid) {
        return {
            kind: "challenge",
            key: candid.Success.key,
            pngBase64: candid.Success.png_base64,
        };
    }

    throw new UnsupportedValueError("Unexpected ApiCreateChallengeResponse type received", candid);
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
    if ("ChallengeFailed" in candid) {
        return "challenge_failed";
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
    if ("Success" in candid) {
        const r = candid.Success;
        console.log("User: ", r);
        const version = r.wasm_version;
        return {
            kind: "created_user",
            userId: r.user_id.toString(),
            username: r.username,
            cryptoAccount: bytesToHexString(r.icp_account),
            phoneStatus: phoneStatus(r.phone_status),
            canisterUpgradeStatus:
                "Required" in r.canister_upgrade_status
                    ? "required"
                    : "NotRequired" in r.canister_upgrade_status
                    ? "not_required"
                    : "in_progress",
            wasmVersion: new Version(version.major, version.minor, version.patch),
            openStorageLimitBytes: Number(r.open_storage_limit_bytes),
            referrals: r.referrals.map((p) => p.toString()),
            isSuperAdmin: r.is_super_admin,
            suspensionDetails: optional(r.suspension_details, suspensionDetails),
            isSuspectedBot: r.is_suspected_bot,
            premiumUntil: undefined,
            // premiumUntil: Date.now() + 1000 * 60 * 60 * 24 * 31, // TODO - fill in when we have this
        };
    }

    if ("UserNotFound" in candid) {
        return { kind: "unknown_user" };
    }

    throw new Error(`Unexpected ApiCurrentUserResponse type received: ${candid}`);
}

function suspensionDetails(candid: ApiSuspensionDetails): SuspensionDetails {
    return {
        reason: candid.reason,
        action: suspensionAction(candid.action),
        suspendedBy: candid.suspended_by.toString(),
    };
}

function suspensionAction(candid: ApiSuspensionAction): SuspensionAction {
    if ("Unsuspend" in candid) {
        return {
            kind: "unsuspend_action",
            timestamp: candid.Unsuspend,
        };
    } else if ("Delete" in candid) {
        return {
            kind: "delete_action",
            timestamp: candid.Delete,
        };
    }

    throw new Error(`Unexpected ApiSuspensionAction type received: ${candid}`);
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

export function checkUsernameResponse(candid: ApiCheckUsernameResponse): CheckUsernameResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("UsernameTaken" in candid) {
        return "username_taken";
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
    throw new UnsupportedValueError("Unexpected ApiCheckUsernameResponse type received", candid);
}

export function setUsernameResponse(candid: ApiSetUsernameResponse): SetUsernameResponse {
    if ("Success" in candid) {
        return "success";
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

export function suspendUserResponse(candid: ApiSuspendUserResponse): SuspendUserResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("InternalError" in candid) {
        return "internal_error";
    }
    if ("UserAlreadySuspended" in candid) {
        return "user_already_suspended";
    }
    if ("UserNotFound" in candid) {
        return "user_not_found";
    }
    throw new UnsupportedValueError("Unexpected ApiSuspendUserResponse type received", candid);
}

export function unsuspendUserResponse(candid: ApiUnsuspendUserResponse): UnsuspendUserResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("InternalError" in candid) {
        return "internal_error";
    }
    if ("UserNotFound" in candid) {
        return "user_not_found";
    }
    if ("UserNotSuspended" in candid) {
        return "user_not_suspended";
    }
    throw new UnsupportedValueError("Unexpected ApiSuspendUserResponse type received", candid);
}
