import {
    CheckUsernameResponse,
    SetUsernameResponse,
    CurrentUserResponse,
    UsersResponse,
    UserSummary,
    PartialUserSummary,
    UnsupportedValueError,
    SuspendUserResponse,
    UnsuspendUserResponse,
    SuspensionDetails,
    SuspensionAction,
    DiamondMembershipDetails,
    DiamondMembershipDuration,
    PayForDiamondMembershipResponse,
    Cryptocurrency,
    ReferralLeaderboardResponse,
    ReferralStats,
} from "openchat-shared";
import type {
    ApiCheckUsernameResponse,
    ApiCurrentUserResponse,
    ApiDiamondMembershipDetails,
    ApiDiamondMembershipPlanDuration,
    ApiPartialUserSummary,
    ApiPayForDiamondMembershipResponse,
    ApiReferralLeaderboardResponse,
    ApiReferralStats,
    ApiSearchResponse,
    ApiSetUsernameResponse,
    ApiSuspendUserResponse,
    ApiSuspensionAction,
    ApiSuspensionDetails,
    ApiUnsuspendUserResponse,
    ApiUserRegistrationCanisterResponse,
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

export function userRegistrationCanisterResponse(candid: ApiUserRegistrationCanisterResponse): string {
    if ("Success" in candid) {
        return candid.Success.toString();
    }
    throw new Error(`Unexpected ApiUserRegistrationCanisterResponse type received: ${candid}`)
}

export function currentUserResponse(candid: ApiCurrentUserResponse): CurrentUserResponse {
    if ("Success" in candid) {
        const r = candid.Success;

        console.log("User: ", r);
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

export function referralStat(candid: ApiReferralStats): ReferralStats {
    return {
        username: candid.username,
        totalUsers: candid.total_users,
        userId: candid.user_id.toString(),
        diamondMembers: candid.diamond_members,
        totalRewardsE8s: candid.total_rewards_e8s,
    };
}

export function referralLeaderboardResponse(
    candid: ApiReferralLeaderboardResponse
): ReferralLeaderboardResponse {
    if ("AllTime" in candid) {
        return { kind: "all_time", stats: candid.AllTime.map(referralStat) };
    }
    if ("Month" in candid) {
        return {
            kind: "monthly",
            stats: candid.Month.results.map(referralStat),
            year: candid.Month.year,
            month: candid.Month.month,
        };
    }
    throw new UnsupportedValueError(
        "Unexpected ApiReferralLeaderboardResponse type received",
        candid
    );
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
