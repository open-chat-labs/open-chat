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
} from "../../domain/user/user";
import type {
    ApiConfirmationState,
    ApiConfirmPhoneNumberResponse,
    ApiCreateCanisterResponse,
    ApiCurrentUserResponse,
    ApiGenerateRegistrationFeeResponse,
    ApiPartialUserSummary,
    ApiPhoneNumber,
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

export function userSearchResponse(candid: ApiSearchResponse): UserSummary[] {
    if ("Success" in candid) {
        return candid.Success.users.map(userSummary);
    }
    throw new Error(`Unknown UserIndex.SearchResponse of ${candid}`);
}

export function usersResponse(candid: ApiUsersResponse): UsersResponse {
    if ("Success" in candid) {
        return {
            timestamp: candid.Success.timestamp,
            users: candid.Success.users.map(partialUserSummary),
        };
    }
    throw new Error(`Unknown UserIndex.UsersResponse of ${candid}`);
}

export function partialUserSummary(candid: ApiPartialUserSummary): PartialUserSummary {
    return {
        userId: candid.user_id.toString(),
        username: optional(candid.username, identity),
        blobReference: optional(candid.avatar_id, (id) => ({
            blobId: id,
            canisterId: candid.user_id.toString(),
        })),
        lastOnline: Date.now() - candid.seconds_since_last_online * 1000,
    };
}

export function userSummary(candid: ApiUserSummary): UserSummary {
    return {
        userId: candid.user_id.toString(),
        username: candid.username,
        lastOnline: Date.now() - candid.seconds_since_last_online * 1000,
        blobReference: optional(candid.avatar_id, (id) => ({
            blobId: id,
            canisterId: candid.user_id.toString(),
        })),
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
    if ("CyclesFee" in candid) {
        return {
            kind: "cycles_fee_registration",
            amount: candid.CyclesFee.amount,
        };
    }
    throw new UnsupportedValueError("Unexpected ApiRegistrationState type received", candid);
}

export function generateRegistrationFeeResponse(
    candid: ApiGenerateRegistrationFeeResponse
): RegistrationFeeResponse {
    if ("AlreadyRegistered" in candid) {
        return {
            kind: "already_registered",
        };
    }
    if ("Success" in candid) {
        return {
            kind: "success",
            validUntil: candid.Success.valid_until,
            amount: candid.Success.amount,
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
    if ("CyclesFee" in candid) {
        return {
            kind: "cycles_fee_registration",
            amount: candid.CyclesFee,
        };
    }
    throw new UnsupportedValueError("Unexpected ApiConfirmationState type received", candid);
}

export function currentUserResponse(candid: ApiCurrentUserResponse): CurrentUserResponse {
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
