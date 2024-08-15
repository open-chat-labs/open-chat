import * as z from "zod";
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
    ApiDiamondMembershipDetails,
    ApiDiamondMembershipPlanDuration,
    ApiDiamondMembershipSubscription,
    ApiPayForDiamondMembershipResponse,
    ApiSetDisplayNameResponse,
    ApiSetUsernameResponse,
    ApiSubmitProofOfUniquePersonhoodResponse,
    ApiSuspendUserResponse,
    ApiUnsuspendUserResponse,
} from "./candid/idl";
import { bytesToHexString, identity, mapOptional } from "../../utils/mapping";
import { tokenJson } from "../common/chatMappers";
import {
    currentUserSummarySchema,
    diamondMembershipDetailsSchema,
    diamondMembershipStatusFullSchema,
    diamondMembershipStatusSchema,
    diamondMembershipSubscriptionSchema,
    suspensionActionSchema,
    type suspensionDetailsSchema,
    userIndexCheckUsernameResponseSchema,
    userIndexChitLeaderboardChitUserBalanceSchema,
    userIndexChitLeaderboardResponseSchema,
    userIndexCurrentUserResponseSchema,
    userIndexDiamondMembershipFeesResponseSchema,
    userIndexReferralLeaderboardReferralStatsSchema,
    userIndexReferralLeaderboardResponseSchema,
    userIndexSearchResponseSchema,
    userIndexUserRegistrationCanisterResponseSchema,
    userIndexUsersResponseSchema,
    userSummarySchema,
    userSummaryV2Schema,
} from "../../zod";

export function userSearchResponseJson(
    json: z.infer<typeof userIndexSearchResponseSchema>,
): UserSummary[] {
    if ("Success" in json) {
        const timestamp = json.Success.timestamp;
        return json.Success.users.map((u) => userSummaryJson(u, timestamp));
    }
    throw new Error(`Unknown UserIndex.SearchResponse of ${json}`);
}

export function usersApiResponse(
    json: z.infer<typeof userIndexUsersResponseSchema>,
): UsersApiResponse {
    if ("Success" in json) {
        const timestamp = json.Success.timestamp;
        return {
            serverTimestamp: timestamp,
            users: json.Success.users.map(userSummaryUpdate),
            deletedUserIds: new Set(json.Success.deleted),
            currentUser: mapOptional(json.Success.current_user, (u) =>
                currentUserSummaryJson(u, timestamp),
            ),
        };
    }
    throw new Error(`Unknown UserIndex.UsersResponse of ${json}`);
}

export function currentUserSummaryJson(
    json: z.infer<typeof currentUserSummarySchema>,
    timestamp: bigint,
): CurrentUserSummary {
    return {
        kind: "current_user_summary",
        username: json.username,
        isPlatformOperator: json.is_platform_operator,
        diamondStatus: diamondMembershipStatusJson(json.diamond_membership_status),
        userId: json.user_id,
        isBot: json.is_bot,
        displayName: mapOptional(json.display_name, identity),
        moderationFlagsEnabled: json.moderation_flags_enabled,
        isSuspectedBot: json.is_suspected_bot,
        suspensionDetails: mapOptional(json.suspension_details, suspensionDetailsJson),
        isPlatformModerator: json.is_platform_moderator,
        diamondDetails: mapOptional(json.diamond_membership_details, diamondMembershipJson),
        updated: timestamp,
        blobReference: mapOptional(json.avatar_id, (id) => ({
            blobId: id,
            canisterId: json.user_id,
        })),
        isUniquePerson: json.is_unique_person,
    };
}

export function userSummaryUpdate(json: z.infer<typeof userSummaryV2Schema>): UserSummaryUpdate {
    return {
        userId: json.user_id,
        stable: mapOptional(json.stable, (s) => ({
            username: s.username,
            diamondStatus: diamondStatus(s.diamond_membership_status),
            isBot: s.is_bot,
            displayName: mapOptional(s.display_name, identity),
            blobReference: mapOptional(s.avatar_id, (id) => ({
                blobId: id,
                canisterId: json.user_id,
            })),
            suspended: s.suspended,
            isUniquePerson: s.is_unique_person,
        })),
        volatile: mapOptional(json.volatile, (v) => ({
            chitBalance: v.chit_balance,
            streak: v.streak,
            totalChitEarned: v.total_chit_earned,
        })),
    };
}

export function userSummaryJson(
    json: z.infer<typeof userSummarySchema>,
    timestamp: bigint,
): UserSummary {
    return {
        kind: json.is_bot ? "bot" : "user",
        userId: json.user_id,
        username: json.username,
        displayName: mapOptional(json.display_name, identity),
        blobReference: mapOptional(json.avatar_id, (id) => ({
            blobId: id,
            canisterId: json.user_id,
        })),
        updated: timestamp,
        suspended: json.suspended,
        diamondStatus: diamondStatus(json.diamond_membership_status),
        chitBalance: json.chit_balance,
        totalChitEarned: json.total_chit_earned,
        streak: json.streak,
        isUniquePerson: json.is_unique_person,
    };
}

export function diamondStatus(
    json: z.infer<typeof diamondMembershipStatusSchema>,
): DiamondMembershipStatus["kind"] {
    if (json === "Inactive") {
        return "inactive";
    }
    if (json === "Active") {
        return "active";
    }
    if (json === "Lifetime") {
        return "lifetime";
    }
    throw new UnsupportedValueError("Unexpected DiamondMembershipStatus type received", json);
}

export function userRegistrationCanisterResponseJson(
    json: z.infer<typeof userIndexUserRegistrationCanisterResponseSchema>,
): string {
    if (json !== "NewRegistrationsClosed" && "Success" in json) {
        return json.Success;
    }
    throw new Error(`Unexpected UserRegistrationCanisterResponse type received: ${json}`);
}

export function currentUserResponseJson(
    json: z.infer<typeof userIndexCurrentUserResponseSchema>,
): CurrentUserResponse {
    if (json === "UserNotFound") {
        return { kind: "unknown_user" };
    }

    if ("Success" in json) {
        const r = json.Success;

        console.log("User: ", r);
        return {
            kind: "created_user",
            userId: r.user_id,
            username: r.username,
            dateCreated: r.date_created,
            displayName: r.display_name ?? undefined,
            cryptoAccount: bytesToHexString(r.icp_account),
            referrals: r.referrals,
            isPlatformModerator: r.is_platform_moderator,
            isPlatformOperator: r.is_platform_operator,
            suspensionDetails: mapOptional(r.suspension_details, suspensionDetailsJson),
            isSuspectedBot: r.is_suspected_bot,
            diamondStatus: diamondMembershipStatusJson(r.diamond_membership_status),
            moderationFlagsEnabled: r.moderation_flags_enabled,
            isBot: false,
            updated: BigInt(Date.now()),
            isUniquePerson: json.Success.is_unique_person,
        };
    }

    throw new Error(`Unexpected CurrentUserResponse type received: ${json}`);
}

function diamondMembershipStatusJson(
    json: z.infer<typeof diamondMembershipStatusFullSchema>,
): DiamondMembershipStatus {
    if (json === "Inactive") {
        return { kind: "inactive" };
    }
    if (json === "Lifetime") {
        return { kind: "lifetime" };
    }
    if ("Active" in json) {
        return {
            kind: "active",
            ...diamondMembershipJson(json.Active),
        };
    }
    throw new UnsupportedValueError(
        "Unexpected DiamondMembershipStatusFullJson type received",
        json,
    );
}

function diamondMembership(candid: ApiDiamondMembershipDetails): DiamondMembershipDetails {
    return {
        expiresAt: candid.expires_at,
        subscription: diamondMembershipSubscription(candid.subscription),
        payInChat: candid.pay_in_chat,
    };
}

function diamondMembershipJson(
    json: z.infer<typeof diamondMembershipDetailsSchema>,
): DiamondMembershipDetails {
    return {
        expiresAt: json.expires_at,
        subscription: diamondMembershipSubscriptionJson(json.subscription),
        payInChat: json.pay_in_chat,
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

function diamondMembershipSubscriptionJson(
    json: z.infer<typeof diamondMembershipSubscriptionSchema>,
): DiamondMembershipSubscription {
    if (json === "OneMonth") {
        return "one_month";
    }
    if (json === "ThreeMonths") {
        return "three_months";
    }
    if (json === "OneYear") {
        return "one_year";
    }
    if (json === "Disabled") {
        return "disabled";
    }
    throw new UnsupportedValueError(
        "Unexpected DiamondMembershipSubscriptionJson type received",
        json,
    );
}

function suspensionDetailsJson(json: z.infer<typeof suspensionDetailsSchema>): SuspensionDetails {
    return {
        reason: json.reason,
        action: suspensionActionJson(json.action),
        suspendedBy: json.suspended_by,
    };
}

function suspensionActionJson(json: z.infer<typeof suspensionActionSchema>): SuspensionAction {
    if ("Unsuspend" in json) {
        return {
            kind: "unsuspend_action",
            timestamp: json.Unsuspend,
        };
    } else if ("Delete" in json) {
        return {
            kind: "delete_action",
            timestamp: json.Delete,
        };
    }

    throw new Error(`Unexpected SuspensionAction type received: ${json}`);
}

export function checkUsernameResponse(
    json: z.infer<typeof userIndexCheckUsernameResponseSchema>,
): CheckUsernameResponse {
    if (json === "Success") {
        return "success";
    }
    if (json === "UsernameTaken") {
        return "username_taken";
    }
    if (json === "UsernameInvalid") {
        return "username_invalid";
    }
    if ("UsernameTooShort" in json) {
        return "username_too_short";
    }
    if ("UsernameTooLong" in json) {
        return "username_too_long";
    }
    throw new UnsupportedValueError("Unexpected CheckUsernameResponse type received", json);
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

export function referralStat(
    json: z.infer<typeof userIndexReferralLeaderboardReferralStatsSchema>,
): ReferralStats {
    return {
        username: json.username,
        totalUsers: json.total_users,
        userId: json.user_id,
        diamondMembers: json.diamond_members,
        totalRewardsE8s: json.total_rewards_e8s,
    };
}

export function referralLeaderboardResponse(
    json: z.infer<typeof userIndexReferralLeaderboardResponseSchema>,
): ReferralLeaderboardResponse {
    if ("AllTime" in json) {
        return { kind: "all_time", stats: json.AllTime.map(referralStat) };
    }
    if ("Month" in json) {
        return {
            kind: "monthly",
            stats: json.Month.results.map(referralStat),
            year: json.Month.year,
            month: json.Month.month,
        };
    }
    throw new UnsupportedValueError(
        "Unexpected ApiReferralLeaderboardResponse type received",
        json,
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
    json: z.infer<typeof userIndexDiamondMembershipFeesResponseSchema>,
): DiamondMembershipFees[] {
    if ("Success" in json) {
        return json.Success.map((f) => ({
            token: tokenJson(f.token) as "CHAT" | "ICP",
            oneMonth: f.one_month,
            threeMonths: f.three_months,
            oneYear: f.one_year,
            lifetime: f.lifetime,
        }));
    }
    throw new UnsupportedValueError("Unexpected DiamondMembershipFeesResponse type received", json);
}

export function chitLeaderboardResponseJson(
    json: z.infer<typeof userIndexChitLeaderboardResponseSchema>,
): ChitUserBalance[] {
    if ("Success" in json) {
        return json.Success.map(chitUserBalance);
    }
    throw new UnsupportedValueError("Unexpected ChitLeaderboardResponse type received", json);
}

function chitUserBalance(
    json: z.infer<typeof userIndexChitLeaderboardChitUserBalanceSchema>,
): ChitUserBalance {
    return {
        userId: json.user_id,
        balance: json.balance,
        username: json.username,
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
