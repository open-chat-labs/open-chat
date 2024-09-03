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
import {
    bytesToHexString,
    identity,
    mapOptional,
    principalBytesToString,
} from "../../utils/mapping";
import { tokenJson } from "../common/chatMappers";
import type {
    CurrentUserSummary as TCurrentUserSummary,
    DiamondMembershipDetails as TDiamondMembershipDetails,
    DiamondMembershipPlanDuration as TDiamondMembershipPlanDuration,
    DiamondMembershipStatusFull as TDiamondMembershipStatusFull,
    DiamondMembershipStatus as TDiamondMembershipStatus,
    DiamondMembershipSubscription as TDiamondMembershipSubscription,
    SuspensionAction as TSuspensionAction,
    SuspensionDetails as TSuspensionDetails,
    UserIndexCheckUsernameResponse,
    UserIndexChitLeaderboardChitUserBalance,
    UserIndexChitLeaderboardResponse,
    UserIndexCurrentUserResponse,
    UserIndexDiamondMembershipFeesResponse,
    UserIndexPayForDiamondMembershipResponse,
    UserIndexSearchResponse,
    UserIndexSetDisplayNameResponse,
    UserIndexSetUsernameResponse,
    UserIndexSubmitProofOfUniquePersonhoodResponse,
    UserIndexSuspendUserResponse,
    UserIndexUnsuspendUserResponse,
    UserIndexUserRegistrationCanisterResponse,
    UserIndexUsersResponse,
    UserSummary as TUserSummary,
    UserSummaryV2 as TUserSummaryV2,
} from "../../typebox";

export function userSearchResponse(json: UserIndexSearchResponse): UserSummary[] {
    if ("Success" in json) {
        const timestamp = json.Success.timestamp;
        return json.Success.users.map((u) => userSummary(u, timestamp));
    }
    throw new Error(`Unknown UserIndex.SearchResponse of ${candid}`);
}

export function usersApiResponse(json: UserIndexUsersResponse): UsersApiResponse {
    if ("Success" in json) {
        const timestamp = json.Success.timestamp;
        return {
            serverTimestamp: timestamp,
            users: json.Success.users.map(userSummaryUpdate),
            deletedUserIds: new Set(json.Success.deleted.map(principalBytesToString)),
            currentUser: mapOptional(json.Success.current_user, (u) =>
                currentUserSummary(u, timestamp),
            ),
        };
    }
    throw new Error(`Unknown UserIndex.UsersResponse of ${candid}`);
}

export function currentUserSummary(
    json: TCurrentUserSummary,
    timestamp: bigint,
): CurrentUserSummary {
    return {
        kind: "current_user_summary",
        username: json.username,
        isPlatformOperator: json.is_platform_operator,
        diamondStatus: diamondMembershipStatus(json.diamond_membership_status),
        userId: principalBytesToString(json.user_id),
        isBot: json.is_bot,
        displayName: mapOptional(json.display_name, identity),
        moderationFlagsEnabled: json.moderation_flags_enabled,
        isSuspectedBot: json.is_suspected_bot,
        suspensionDetails: mapOptional(json.suspension_details, suspensionDetails),
        isPlatformModerator: json.is_platform_moderator,
        diamondDetails: mapOptional(json.diamond_membership_details, diamondMembership),
        updated: timestamp,
        blobReference: optional(candid.avatar_id, (id) => ({
            blobId: id,
            canisterId: principalBytesToString(json.user_id),
        })),
        isUniquePerson: candid.is_unique_person,
    };
}

export function userSummaryUpdate(json: TUserSummaryV2): UserSummaryUpdate {
    return {
        userId: principalBytesToString(json.user_id),
        stable: mapOptional(json.stable, (s) => ({
            username: s.username,
            diamondStatus: diamondStatus(s.diamond_membership_status),
            isBot: s.is_bot,
            displayName: optional(s.display_name, identity),
            blobReference: optional(s.avatar_id, (id) => ({
                blobId: id,
                canisterId: principalBytesToString(json.user_id),
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

export function userSummary(json: TUserSummary, timestamp: bigint): UserSummary {
    return {
        kind: json.is_bot ? "bot" : "user",
        userId: principalBytesToString(json.user_id),
        username: json.username,
        displayName: mapOptional(json.display_name, identity),
        blobReference: mapOptional(json.avatar_id, (id) => ({
            blobId: id,
            canisterId: principalBytesToString(json.user_id),
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

export function diamondStatus(json: TDiamondMembershipStatus): DiamondMembershipStatus["kind"] {
    if (json === "Inactive") {
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
    json: UserIndexUserRegistrationCanisterResponse,
): string {
    if (json !== "NewRegistrationsClosed" && "Success" in json) {
        return principalBytesToString(json.Success);
    }
    throw new Error(`Unexpected ApiUserRegistrationCanisterResponse type received: ${candid}`);
}

export function currentUserResponse(json: UserIndexCurrentUserResponse): CurrentUserResponse {
    if (json === "UserNotFound") {
        return { kind: "unknown_user" };
    }

    if ("Success" in json) {
        const r = json.Success;

        console.log("User: ", r);
        return {
            kind: "created_user",
            userId: principalBytesToString(r.user_id),
            username: r.username,
            dateCreated: r.date_created,
            displayName: optional(r.display_name, identity),
            cryptoAccount: bytesToHexString(r.icp_account),
            referrals: r.referrals.map(principalBytesToString),
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

function diamondMembershipStatus(json: TDiamondMembershipStatusFull): DiamondMembershipStatus {
    if (json === "Inactive") {
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

function diamondMembership(json: TDiamondMembershipDetails): DiamondMembershipDetails {
    return {
        expiresAt: candid.expires_at,
        subscription: diamondMembershipSubscription(candid.subscription),
        payInChat: candid.pay_in_chat,
    };
}

function diamondMembershipSubscription(
    json: TDiamondMembershipSubscription,
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

function suspensionDetails(json: TSuspensionDetails): SuspensionDetails {
    return {
        reason: json.reason,
        action: suspensionAction(json.action),
        suspendedBy: principalBytesToString(json.suspended_by),
    };
}

function suspensionAction(json: TSuspensionAction): SuspensionAction {
    if ("Unsuspend" in json) {
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

export function checkUsernameResponse(json: UserIndexCheckUsernameResponse): CheckUsernameResponse {
    if (json === "Success") {
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

export function setUsernameResponse(json: UserIndexSetUsernameResponse): SetUsernameResponse {
    if (json === "Success") {
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

export function setDisplayNameResponse(
    json: UserIndexSetDisplayNameResponse,
): SetDisplayNameResponse {
    if (json === "Success") {
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

export function suspendUserResponse(json: UserIndexSuspendUserResponse): SuspendUserResponse {
    if (json === "Success") {
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

export function unsuspendUserResponse(json: UserIndexUnsuspendUserResponse): UnsuspendUserResponse {
    if (json === "Success") {
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
    duration: DiamondMembershipDuration,
    json: UserIndexPayForDiamondMembershipResponse,
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
): TDiamondMembershipPlanDuration {
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
    json: UserIndexDiamondMembershipFeesResponse,
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

export function chitLeaderboardResponse(json: UserIndexChitLeaderboardResponse): ChitUserBalance[] {
    if ("Success" in json) {
        return json.Success.map(chitUserBalance);
    }
    throw new UnsupportedValueError("Unexpected ChitLeaderboardResponse type received", candid);
}

function chitUserBalance(json: UserIndexChitLeaderboardChitUserBalance): ChitUserBalance {
    return {
        userId: principalBytesToString(json.user_id),
        balance: json.balance,
        username: json.username,
    };
}

export function submitProofOfUniquePersonhoodResponse(
    json: UserIndexSubmitProofOfUniquePersonhoodResponse,
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
