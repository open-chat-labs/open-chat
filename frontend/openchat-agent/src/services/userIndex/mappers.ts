import {
    CheckUsernameResponse,
    SetUsernameResponse,
    CurrentUserResponse,
    CreateChallengeResponse,
    UsersResponse,
    UserSummary,
    PartialUserSummary,
    RegisterUserResponse,
    Version,
    UnsupportedValueError,
    SuspendUserResponse,
    UnsuspendUserResponse,
    SuspensionDetails,
    SuspensionAction,
    DiamondMembershipDetails,
    DiamondMembershipDuration,
    PayForDiamondMembershipResponse,
    Cryptocurrency,
    SetNeuronControllerResponse,
    EligibleForInitialAirdropResponse,
} from "openchat-shared";
import type {
    ApiCheckUsernameResponse,
    ApiCreateChallengeResponse,
    ApiCurrentUserResponse,
    ApiDiamondMembershipDetails,
    ApiDiamondMembershipPlanDuration,
    ApiIsEligibleForInitialAirdropResponse,
    ApiPartialUserSummary,
    ApiPayForDiamondMembershipResponse,
    ApiRegisterUserResponse,
    ApiSearchResponse,
    ApiSetNeuronControllerForInitialAirdropResponse,
    ApiSetUsernameResponse,
    ApiSuspendUserResponse,
    ApiSuspensionAction,
    ApiSuspensionDetails,
    ApiUnsuspendUserResponse,
    ApiUsersResponse,
    ApiUserSummary,
} from "./candid/idl";
import { bytesToHexString, identity, optional } from "../../utils/mapping";
import type { ApiCryptocurrency } from "../user/candid/idl";

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
        diamond: candid.diamond_member,
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
        diamond: candid.diamond_member,
    };
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
    if ("NotRequired" in candid) {
        return {
            kind: "not_required"
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
    if ("PublicKeyInvalid" in candid) {
        return "public_key_invalid";
    }

    throw new UnsupportedValueError("Unexpected ApiRegisterUserResponse type received", candid);
}

export function setNeuronControllerResponse(
    candid: ApiSetNeuronControllerForInitialAirdropResponse
): SetNeuronControllerResponse {
    if ("Success" in candid) {
        return "success";
    }

    if ("UserNotFound" in candid) {
        return "user_not_found";
    }

    if ("UserNotEligible" in candid) {
        return "user_not_eligible";
    }

    if ("AirdropClosed" in candid) {
        return "airdrop_closed";
    }

    throw new Error(
        `Unexpected ApiSetNeuronControllerForInitialAirdropResponse type received: ${candid}`
    );
}

export function isEligibleForInitialAirdropResponse(
    candid: ApiIsEligibleForInitialAirdropResponse
): EligibleForInitialAirdropResponse {
    if ("Yes" in candid) {
        return { kind: "user_eligible", principal: optional(candid.Yes, (p) => p.toString()) };
    }
    if ("No" in candid) {
        return { kind: "user_not_eligible" };
    }
    if ("AirdropClosed" in candid) {
        return { kind: "airdrop_closed" };
    }
    if ("UserNotFound" in candid) {
        return { kind: "unknown_user" };
    }
    throw new Error(`Unexpected ApiIsEligibleForInitialAirdropResponse type received: ${candid}`);
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
            canisterUpgradeStatus:
                "Required" in r.canister_upgrade_status
                    ? "required"
                    : "NotRequired" in r.canister_upgrade_status
                    ? "not_required"
                    : "in_progress",
            wasmVersion: new Version(version.major, version.minor, version.patch),
            referrals: r.referrals.map((p) => p.toString()),
            isPlatformModerator: r.is_super_admin,
            suspensionDetails: optional(r.suspension_details, suspensionDetails),
            isSuspectedBot: r.is_suspected_bot,
            diamondMembership: optional(r.diamond_membership_details, diamondMembership),
        };
    }

    if ("UserNotFound" in candid) {
        return { kind: "unknown_user" };
    }

    throw new Error(`Unexpected ApiCurrentUserResponse type received: ${candid}`);
}

function diamondMembership(candid: ApiDiamondMembershipDetails): DiamondMembershipDetails {
    return {
        expiresAt: candid.expires_at,
        recurring: optional(candid.recurring, diamondMembershipDuration),
    };
}

function diamondMembershipDuration(
    candid: ApiDiamondMembershipPlanDuration
): DiamondMembershipDuration {
    if ("OneMonth" in candid) {
        return "one_month";
    }
    if ("ThreeMonths" in candid) {
        return "three_months";
    }
    if ("OneYear" in candid) {
        return "one_year";
    }
    throw new Error(`Unexpected ApiDiamondMembershipPlanDuration type received: ${candid}`);
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

export function payForDiamondMembershipResponse(
    candid: ApiPayForDiamondMembershipResponse
): PayForDiamondMembershipResponse {
    if ("PaymentAlreadyInProgress" in candid) {
        return { kind: "payment_already_in_progress" };
    }
    if ("CurrencyNotSupported" in candid) {
        return { kind: "currency_not_supported" };
    }
    if ("Success" in candid) {
        return { kind: "success", details: diamondMembership(candid.Success) };
    }
    if ("PriceMismatch" in candid) {
        return { kind: "price_mismatch" };
    }
    if ("TransferFailed" in candid) {
        return { kind: "transfer_failed" };
    }
    if ("InternalError" in candid) {
        return { kind: "internal_error" };
    }
    if ("CannotExtend" in candid) {
        return { kind: "cannot_extend" };
    }
    if ("UserNotFound" in candid) {
        return { kind: "user_not_found" };
    }
    if ("InsufficientFunds" in candid) {
        return { kind: "insufficient_funds" };
    }
    throw new UnsupportedValueError(
        "Unexpected ApiPayForDiamondMembershipResponse type received",
        candid
    );
}

export function apiCryptocurrency(domain: Cryptocurrency): ApiCryptocurrency {
    if (domain === "icp") {
        return { InternetComputer: null };
    }
    if (domain === "chat") {
        return { CHAT: null };
    }
    if (domain === "ckbtc") {
        return { CKBTC: null };
    }
    if (domain === "sns1") {
        return { SNS1: null };
    }
    throw new UnsupportedValueError("Unexpected Cryptocurrency type received", domain);
}

export function apiDiamondDuration(
    domain: DiamondMembershipDuration
): ApiDiamondMembershipPlanDuration {
    if (domain === "one_month") {
        return { OneMonth: null };
    }
    if (domain === "three_months") {
        return { ThreeMonths: null };
    }
    if (domain === "one_year") {
        return { OneYear: null };
    }
    throw new UnsupportedValueError("Unexpected DiamondMembershipDuration type received", domain);
}
