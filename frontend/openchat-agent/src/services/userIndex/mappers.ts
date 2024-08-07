import type {
    CheckUsernameResponse,
    SetUsernameResponse,
    CurrentUserResponse,
    UserSummary,
    SuspendUserResponse,
    UnsuspendUserResponse,
    SuspensionDetails,
    SuspensionAction,
    DiamondMembershipDetails,
    DiamondMembershipDuration,
    DiamondMembershipFees,
    PayForDiamondMembershipResponse,
    ReferralLeaderboardResponse,
    ReferralStats,
    SetDisplayNameResponse,
    DiamondMembershipSubscription,
    DiamondMembershipStatus,
    ChitUserBalance,
    CurrentUserSummary,
    UsersApiResponse,
    UserSummaryUpdate,
    SubmitProofOfUniquePersonhoodResponse,
} from "openchat-shared";
import { CommonResponses, UnsupportedValueError } from "openchat-shared";
import type {
    ApiCheckUsernameResponse,
    ApiChitUserBalance,
    ApiCurrentUserResponse,
    ApiCurrentUserSummary,
    ApiDiamondMembershipDetails,
    ApiDiamondMembershipFeesResponse,
    ApiDiamondMembershipPlanDuration,
    ApiDiamondMembershipStatus,
    ApiDiamondMembershipStatusFull,
    ApiDiamondMembershipSubscription,
    ApiPayForDiamondMembershipResponse,
    ApiReferralLeaderboardResponse,
    ApiReferralStats,
    ApiSearchResponse,
    ApiSetDisplayNameResponse,
    ApiSetUsernameResponse,
    ApiSubmitProofOfUniquePersonhoodResponse,
    ApiSuspendUserResponse,
    ApiSuspensionAction,
    ApiSuspensionDetails,
    ApiUnsuspendUserResponse,
    ApiUserRegistrationCanisterResponse,
    ApiUsersResponse,
    ApiUserSummary,
    ApiUserSummaryUpdate,
} from "./candid/idl";
import { bytesToHexString, identity, optional } from "../../utils/mapping";
import { token } from "../common/chatMappers";
import type { ChitLeaderboardResponse } from "./candid/types";

export function userSearchResponse(candid: ApiSearchResponse): UserSummary[] {
    if ("Success" in candid) {
        const timestamp = candid.Success.timestamp;
        return candid.Success.users.map((u) => userSummary(u, timestamp));
    }
    throw new Error(`Unknown UserIndex.SearchResponse of ${candid}`);
}

export function usersApiResponse(candid: ApiUsersResponse): UsersApiResponse {
    if ("Success" in candid) {
        const timestamp = candid.Success.timestamp;
        return {
            serverTimestamp: timestamp,
            users: candid.Success.users.map(userSummaryUpdate),
            deletedUserIds: new Set(candid.Success.deleted.map((d) => d.toString())),
            currentUser: optional(candid.Success.current_user, (u) =>
                currentUserSummary(u, timestamp),
            ),
        };
    }
    throw new Error(`Unknown UserIndex.UsersResponse of ${candid}`);
}

export function currentUserSummary(
    candid: ApiCurrentUserSummary,
    timestamp: bigint,
): CurrentUserSummary {
    return {
        kind: "current_user_summary",
        username: candid.username,
        isPlatformOperator: candid.is_platform_operator,
        diamondStatus: diamondMembershipStatus(candid.diamond_membership_status),
        userId: candid.user_id.toString(),
        isBot: candid.is_bot,
        displayName: optional(candid.display_name, identity),
        moderationFlagsEnabled: candid.moderation_flags_enabled,
        isSuspectedBot: candid.is_suspected_bot,
        suspensionDetails: optional(candid.suspension_details, suspensionDetails),
        isPlatformModerator: candid.is_platform_moderator,
        diamondDetails: optional(candid.diamond_membership_details, diamondMembership),
        updated: timestamp,
        blobReference: optional(candid.avatar_id, (id) => ({
            blobId: id,
            canisterId: candid.user_id.toString(),
        })),
        isUniquePerson: candid.is_unique_person,
    };
}

export function userSummaryUpdate(candid: ApiUserSummaryUpdate): UserSummaryUpdate {
    return {
        userId: candid.user_id.toString(),
        stable: optional(candid.stable, (s) => ({
            username: s.username,
            diamondStatus: diamondStatus(s.diamond_membership_status),
            isBot: s.is_bot,
            displayName: optional(s.display_name, identity),
            blobReference: optional(s.avatar_id, (id) => ({
                blobId: id,
                canisterId: candid.user_id.toString(),
            })),
            suspended: s.suspended,
            isUniquePerson: s.is_unique_person,
        })),
        volatile: optional(candid.volatile, (v) => ({
            chitBalance: v.chit_balance,
            streak: v.streak,
            totalChitEarned: v.total_chit_earned,
        })),
    };
}

export function userSummary(candid: ApiUserSummary, timestamp: bigint): UserSummary {
    return {
        kind: candid.is_bot ? "bot" : "user",
        userId: candid.user_id.toString(),
        username: candid.username,
        displayName: optional(candid.display_name, identity),
        blobReference: optional(candid.avatar_id, (id) => ({
            blobId: id,
            canisterId: candid.user_id.toString(),
        })),
        updated: timestamp,
        suspended: candid.suspended,
        diamondStatus: diamondStatus(candid.diamond_membership_status),
        chitBalance: candid.chit_balance,
        totalChitEarned: candid.total_chit_earned,
        streak: candid.streak,
        isUniquePerson: candid.is_unique_person,
    };
}

export function diamondStatus(candid: ApiDiamondMembershipStatus): DiamondMembershipStatus["kind"] {
    if ("Inactive" in candid) {
        return "inactive";
    }
    if ("Active" in candid) {
        return "active";
    }
    if ("Lifetime" in candid) {
        return "lifetime";
    }
    throw new UnsupportedValueError("Unexpected ApiDiamondMembershipStatus type received", candid);
}

export function userRegistrationCanisterResponse(
    candid: ApiUserRegistrationCanisterResponse,
): string {
    if ("Success" in candid) {
        return candid.Success.toString();
    }
    throw new Error(`Unexpected ApiUserRegistrationCanisterResponse type received: ${candid}`);
}

export function currentUserResponse(candid: ApiCurrentUserResponse): CurrentUserResponse {
    if ("Success" in candid) {
        const r = candid.Success;

        console.log("User: ", r);
        return {
            kind: "created_user",
            userId: r.user_id.toString(),
            username: r.username,
            dateCreated: r.date_created,
            displayName: optional(r.display_name, identity),
            cryptoAccount: bytesToHexString(r.icp_account),
            referrals: r.referrals.map((p) => p.toString()),
            isPlatformModerator: r.is_platform_moderator,
            isPlatformOperator: r.is_platform_operator,
            suspensionDetails: optional(r.suspension_details, suspensionDetails),
            isSuspectedBot: r.is_suspected_bot,
            diamondStatus: diamondMembershipStatus(r.diamond_membership_status),
            moderationFlagsEnabled: r.moderation_flags_enabled,
            isBot: false,
            updated: BigInt(Date.now()),
            isUniquePerson: candid.Success.is_unique_person,
        };
    }

    if ("UserNotFound" in candid) {
        return { kind: "unknown_user" };
    }

    throw new Error(`Unexpected ApiCurrentUserResponse type received: ${candid}`);
}

function diamondMembershipStatus(candid: ApiDiamondMembershipStatusFull): DiamondMembershipStatus {
    if ("Inactive" in candid) {
        return { kind: "inactive" };
    }
    if ("Lifetime" in candid) {
        return { kind: "lifetime" };
    }
    if ("Active" in candid) {
        return {
            kind: "active",
            ...diamondMembership(candid.Active),
        };
    }
    throw new UnsupportedValueError(
        "Unexpected ApiDiamondMembershipStatusFull type received",
        candid,
    );
}

function diamondMembership(candid: ApiDiamondMembershipDetails): DiamondMembershipDetails {
    return {
        expiresAt: candid.expires_at,
        subscription: diamondMembershipSubscription(candid.subscription),
        payInChat: candid.pay_in_chat,
    };
}

function diamondMembershipSubscription(
    candid: ApiDiamondMembershipSubscription,
): DiamondMembershipSubscription {
    if ("OneMonth" in candid) {
        return "one_month";
    }
    if ("ThreeMonths" in candid) {
        return "three_months";
    }
    if ("OneYear" in candid) {
        return "one_year";
    }
    if ("Disabled" in candid) {
        return "disabled";
    }
    throw new UnsupportedValueError(
        "Unexpected ApiDiamondMembershipSubscription type received",
        candid,
    );
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

export function setDisplayNameResponse(candid: ApiSetDisplayNameResponse): SetDisplayNameResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("UserNotFound" in candid) {
        return "user_not_found";
    }
    if ("DisplayNameTooShort" in candid) {
        return "display_name_too_short";
    }
    if ("DisplayNameTooLong" in candid) {
        return "display_name_too_long";
    }
    if ("DisplayNameInvalid" in candid) {
        return "display_name_invalid";
    }
    if ("Unauthorized" in candid) {
        return "unauthorized";
    }
    throw new UnsupportedValueError("Unexpected ApiSetDisplayNameResponse type received", candid);
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
    candid: ApiReferralLeaderboardResponse,
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
        candid,
    );
}

export function payForDiamondMembershipResponse(
    duration: DiamondMembershipDuration,
    candid: ApiPayForDiamondMembershipResponse,
): PayForDiamondMembershipResponse {
    if ("PaymentAlreadyInProgress" in candid) {
        return { kind: "payment_already_in_progress" };
    }
    if ("CurrencyNotSupported" in candid) {
        return { kind: "currency_not_supported" };
    }
    if ("Success" in candid) {
        return {
            kind: "success",
            proof: candid.Success.proof_jwt,
            status:
                duration === "lifetime"
                    ? { kind: "lifetime" }
                    : { kind: "active", ...diamondMembership(candid.Success) },
        };
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
    if ("AlreadyLifetimeDiamondMember" in candid) {
        return { kind: "already_lifetime_diamond_member" };
    }
    throw new UnsupportedValueError(
        "Unexpected ApiPayForDiamondMembershipResponse type received",
        candid,
    );
}

export function apiDiamondDuration(
    domain: DiamondMembershipDuration,
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
    if (domain === "lifetime") {
        return { Lifetime: null };
    }
    throw new UnsupportedValueError("Unexpected DiamondMembershipDuration type received", domain);
}

export function diamondMembershipFeesResponse(
    candid: ApiDiamondMembershipFeesResponse,
): DiamondMembershipFees[] {
    if ("Success" in candid) {
        return candid.Success.map((f) => ({
            token: token(f.token) as "CHAT" | "ICP",
            oneMonth: f.one_month,
            threeMonths: f.three_months,
            oneYear: f.one_year,
            lifetime: f.lifetime,
        }));
    }
    throw new UnsupportedValueError(
        "Unexpected ApiDiamondMembershipFeesResponse type received",
        candid,
    );
}

export function chitLeaderboardResponse(candid: ChitLeaderboardResponse): ChitUserBalance[] {
    if ("Success" in candid) {
        return candid.Success.map(chitUserBalance);
    }
    throw new UnsupportedValueError("Unexpected ChitLeaderboardResponse type received", candid);
}

function chitUserBalance(candid: ApiChitUserBalance): ChitUserBalance {
    return {
        userId: candid.user_id.toString(),
        balance: candid.balance,
        username: candid.username,
    };
}

export function submitProofOfUniquePersonhoodResponse(
    candid: ApiSubmitProofOfUniquePersonhoodResponse,
): SubmitProofOfUniquePersonhoodResponse {
    if ("Success" in candid) {
        return CommonResponses.success();
    }
    if ("Invalid" in candid) {
        return CommonResponses.invalid();
    }
    if ("UserNotFound" in candid) {
        return CommonResponses.userNotFound();
    }
    throw new UnsupportedValueError(
        "Unexpected ApiSubmitProofOfUniquePersonhoodResponse type received",
        candid,
    );
}
