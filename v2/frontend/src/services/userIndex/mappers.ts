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
    UpgradeCanisterResponse,
    CreateCanisterResponse,
    RegistrationFeeResponse,
    RegistrationState,
    RegistrationFee,
    NotificationFeePaidResponse,
    RegisterUserResponse,
} from "../../domain/user/user";
import type {
    ApiConfirmationState,
    ApiConfirmPhoneNumberResponse,
    ApiCreateCanisterResponse,
    ApiCurrentUserResponse,
    ApiGenerateRegistrationFeeResponse,
    ApiNotificationFeePaidResponse,
    ApiPartialUserSummary,
    ApiPhoneNumber,
    ApiRegisterUserResponse,
    ApiRegistrationFee,
    ApiResendCodeResponse,
    ApiSearchResponse,
    ApiSetUsernameResponse,
    ApiSubmitPhoneNumberResponse,
    ApiUnconfirmedUserState,
    ApiUpgradeCanisterResponse,
    ApiUsersResponse,
    ApiUserSummary,
} from "./candid/idl";
import { identity, optional } from "../../utils/mapping";
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
    if ("UserLimitReached" in candid) {
        return { kind: "user_limit_reached" };
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
    if ("Success" in candid) return "success";
    if ("UserNotFound" in candid) return "not_found";
    if ("AlreadyClaimed" in candid) return "already_claimed";
    if ("ConfirmationCodeExpired" in candid) return "code_expired";
    if ("ConfirmationCodeIncorrect" in candid) return "code_incorrect";
    if ("PhoneNumberNotSubmitted" in candid) {
        return "phone_number_not_submitted";
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
    if ("UserUnconfirmed" in candid) return "user_unconfirmed";
    if ("UserNotFound" in candid) return "user_not_found";
    if ("CyclesBalanceTooLow" in candid) return "cycles_balance_too_low";

    throw new UnsupportedValueError("Unexpected ApiCreateCanisterResponse type received", candid);
}

export function upgradeCanisterResponse(
    candid: ApiUpgradeCanisterResponse
): UpgradeCanisterResponse {
    if ("Success" in candid) return "success";
    if ("UpgradeInProgress" in candid) return "upgrade_in_progress";
    if ("UserNotCreated" in candid) return "user_not_created";
    if ("UpgradeNotRequired" in candid) return "upgrade_not_required";
    if ("InternalError" in candid) return "internal_error";
    if ("UserNotFound" in candid) return "user_not_found";

    throw new UnsupportedValueError("Unexpected ApiUpgradeCanisterResponse type received", candid);
}

function registrationState(candid: ApiUnconfirmedUserState): RegistrationState {
    if ("PhoneNumber" in candid) {
        return {
            kind: "phone_registration",
            phoneNumber: {
                countryCode: candid.PhoneNumber.phone_number.country_code,
                number: candid.PhoneNumber.phone_number.number,
            },
        };
    }
    if ("RegistrationFee" in candid) {
        return {
            kind: "currency_registration",
            fee: currencyRegistration(candid.RegistrationFee),
        };
    }
    throw new UnsupportedValueError("Unexpected ApiRegistrationState type received", candid);
}

function recipientToHexString(bytes: number[]): string {
    return bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "");
}

function currencyRegistration(candid: ApiRegistrationFee): RegistrationFee {
    if ("ICP" in candid) {
        return {
            kind: "icp_registration_fee",
            validUntil: candid.ICP.valid_until,
            amount: candid.ICP.amount.e8s,
            recipient: recipientToHexString(candid.ICP.recipient),
        };
    }
    if ("Cycles" in candid) {
        return {
            kind: "cycles_registration_fee",
            validUntil: candid.Cycles.valid_until,
            amount: candid.Cycles.amount,
            recipient: candid.Cycles.recipient.toString(),
        };
    }
    throw new UnsupportedValueError("Unexpected ApiRegistrationFee type received", candid);
}

export function feePaidResponse(
    candid: ApiNotificationFeePaidResponse
): NotificationFeePaidResponse {
    if ("AlreadyRegistered" in candid) {
        return "already_registered";
    }
    if ("Success" in candid) {
        return "success";
    }
    if ("PaymentNotFound" in candid) {
        return "payment_not_found";
    }
    if ("InternalError" in candid) {
        return "internal_error";
    }
    if ("UserNotFound" in candid) {
        return "user_not_found";
    }
    throw new UnsupportedValueError(
        "Unexpected ApiNotificationFeePaidResponse type received",
        candid
    );
}

export function generateRegistrationFeeResponse(
    candid: ApiGenerateRegistrationFeeResponse
): RegistrationFeeResponse {
    if ("InvalidCurrency" in candid) {
        return {
            kind: "invalid_currency",
        };
    }
    if ("AlreadyRegistered" in candid) {
        return {
            kind: "already_registered",
        };
    }
    if ("Success" in candid) {
        return {
            kind: "currency_registration",
            fee: currencyRegistration(candid.Success.fee),
        };
    }
    throw new UnsupportedValueError(
        "Unexpected ApiGenerateRegistrationFeeResponse type received",
        candid
    );
}

export function confirmationState(candid: ApiConfirmationState): RegistrationState {
    if ("PhoneNumber" in candid) {
        return {
            kind: "phone_registration",
            phoneNumber: {
                countryCode: candid.PhoneNumber.country_code,
                number: candid.PhoneNumber.number,
            },
        };
    }
    if ("RegistrationFee" in candid) {
        return {
            kind: "currency_registration",
            fee: currencyRegistration(candid.RegistrationFee),
        };
    }
    throw new UnsupportedValueError("Unexpected ApiConfirmationState type received", candid);
}

export function currentUserResponse(candid: ApiCurrentUserResponse): CurrentUserResponse {
    console.log("User: ", candid);
    if ("Unconfirmed" in candid) {
        return {
            kind: "unconfirmed_user",
            registrationState: registrationState(candid.Unconfirmed.state),
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
            registrationState: confirmationState(candid.Confirmed.confirmation_state),
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
            registrationState: confirmationState(
                candid.ConfirmedPendingUsername.confirmation_state
            ),
        };
    }

    if ("Created" in candid) {
        const version = candid.Created.wasm_version;
        return {
            kind: "created_user",
            userId: candid.Created.user_id.toString(),
            username: candid.Created.username,
            canisterUpgradeStatus:
                "Required" in candid.Created.canister_upgrade_status
                    ? "required"
                    : "NotRequired" in candid.Created.canister_upgrade_status
                    ? "not_required"
                    : "in_progress",
            wasmVersion: new Version(version.major, version.minor, version.patch),
        };
    }

    if ("UserNotFound" in candid) {
        return { kind: "unknown_user" };
    }

    throw new UnsupportedValueError("Unexpected ApiCurrentUserResponse type received", candid);
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
    if ("AlreadyClaimed" in candid) {
        return "already_claimed";
    }
    if ("UserNotFound" in candid) {
        return "user_not_found";
    }
    if ("PhoneNumberNotSubmitted" in candid) {
        return "phone_number_not_submitted";
    }
    throw new UnsupportedValueError("Unexpected ApiResendCodeResponse type received", candid);
}
