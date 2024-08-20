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
import { bytesToHexString, identity, mapOptional } from "../../utils/mapping";
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
    userIndexCheckUsernameResponse,
    userIndexChitLeaderboardChitUserBalance,
    userIndexChitLeaderboardResponse,
    userIndexCurrentUserResponse,
    userIndexDiamondMembershipFeesResponse,
    userIndexPayForDiamondMembershipResponse,
    userIndexSearchResponse,
    userIndexSetDisplayNameResponse,
    userIndexSetUsernameResponse,
    userIndexSubmitProofOfUniquePersonhoodResponse,
    userIndexSuspendUserResponse,
    userIndexUnsuspendUserResponse,
    userIndexUserRegistrationCanisterResponse,
    userIndexUsersResponse,
    UserSummary as TUserSummary,
    UserSummaryV2 as TUserSummaryV2,
} from "../../typebox";

export function userSearchResponse(json: userIndexSearchResponse): UserSummary[] {
    if ("Success" in json) {
        const timestamp = json.Success.timestamp;
        return json.Success.users.map((u) => userSummary(u, timestamp));
    }
    throw new Error(`Unknown UserIndex.SearchResponse of ${json}`);
}

export function usersApiResponse(json: userIndexUsersResponse): UsersApiResponse {
    if ("Success" in json) {
        const timestamp = json.Success.timestamp;
        return {
            serverTimestamp: timestamp,
            users: json.Success.users.map(userSummaryUpdate),
            deletedUserIds: new Set(json.Success.deleted.map(bytesToHexString)),
            currentUser: mapOptional(json.Success.current_user, (u) =>
                currentUserSummary(u, timestamp)
            ),
        };
    }
    throw new Error(`Unknown UserIndex.UsersResponse of ${json}`);
}

export function currentUserSummary(
    json: TCurrentUserSummary,
    timestamp: bigint
): CurrentUserSummary {
    return {
        kind: "current_user_summary",
        username: json.username,
        isPlatformOperator: json.is_platform_operator,
        diamondStatus: diamondMembershipStatus(json.diamond_membership_status),
        userId: bytesToHexString(json.user_id),
        isBot: json.is_bot,
        displayName: mapOptional(json.display_name, identity),
        moderationFlagsEnabled: json.moderation_flags_enabled,
        isSuspectedBot: json.is_suspected_bot,
        suspensionDetails: mapOptional(json.suspension_details, suspensionDetails),
        isPlatformModerator: json.is_platform_moderator,
        diamondDetails: mapOptional(json.diamond_membership_details, diamondMembership),
        updated: timestamp,
        blobReference: mapOptional(json.avatar_id, (id) => ({
            blobId: id,
            canisterId: bytesToHexString(json.user_id),
        })),
        isUniquePerson: json.is_unique_person,
    };
}

export function userSummaryUpdate(json: TUserSummaryV2): UserSummaryUpdate {
    return {
        userId: bytesToHexString(json.user_id),
        stable: mapOptional(json.stable, (s) => ({
            username: s.username,
            diamondStatus: diamondStatus(s.diamond_membership_status),
            isBot: s.is_bot,
            displayName: mapOptional(s.display_name, identity),
            blobReference: mapOptional(s.avatar_id, (id) => ({
                blobId: id,
                canisterId: bytesToHexString(json.user_id),
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

export function userSummary(json: TUserSummary, timestamp: bigint): UserSummary {
    return {
        kind: json.is_bot ? "bot" : "user",
        userId: bytesToHexString(json.user_id),
        username: json.username,
        displayName: mapOptional(json.display_name, identity),
        blobReference: mapOptional(json.avatar_id, (id) => ({
            blobId: id,
            canisterId: bytesToHexString(json.user_id),
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

export function diamondStatus(json: TDiamondMembershipStatus): DiamondMembershipStatus["kind"] {
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

export function userRegistrationCanisterResponse(
    json: userIndexUserRegistrationCanisterResponse
): string {
    if (json !== "NewRegistrationsClosed" && "Success" in json) {
        return bytesToHexString(json.Success);
    }
    throw new Error(`Unexpected UserRegistrationCanisterResponse type received: ${json}`);
}

export function currentUserResponse(json: userIndexCurrentUserResponse): CurrentUserResponse {
    if (json === "UserNotFound") {
        return { kind: "unknown_user" };
    }

    if ("Success" in json) {
        const r = json.Success;

        console.log("User: ", r);
        return {
            kind: "created_user",
            userId: bytesToHexString(r.user_id),
            username: r.username,
            dateCreated: r.date_created,
            displayName: r.display_name ?? undefined,
            cryptoAccount: bytesToHexString(r.icp_account),
            referrals: r.referrals.map(bytesToHexString),
            isPlatformModerator: r.is_platform_moderator,
            isPlatformOperator: r.is_platform_operator,
            suspensionDetails: mapOptional(r.suspension_details, suspensionDetails),
            isSuspectedBot: r.is_suspected_bot,
            diamondStatus: diamondMembershipStatus(r.diamond_membership_status),
            moderationFlagsEnabled: r.moderation_flags_enabled,
            isBot: false,
            updated: BigInt(Date.now()),
            isUniquePerson: json.Success.is_unique_person,
        };
    }

    throw new Error(`Unexpected CurrentUserResponse type received: ${json}`);
}

function diamondMembershipStatus(json: TDiamondMembershipStatusFull): DiamondMembershipStatus {
    if (json === "Inactive") {
        return { kind: "inactive" };
    }
    if (json === "Lifetime") {
        return { kind: "lifetime" };
    }
    if ("Active" in json) {
        return {
            kind: "active",
            ...diamondMembership(json.Active),
        };
    }
    throw new UnsupportedValueError(
        "Unexpected DiamondMembershipStatusFullJson type received",
        json
    );
}

function diamondMembership(json: TDiamondMembershipDetails): DiamondMembershipDetails {
    return {
        expiresAt: json.expires_at,
        subscription: diamondMembershipSubscription(json.subscription),
        payInChat: json.pay_in_chat,
    };
}

function diamondMembershipSubscription(
    json: TDiamondMembershipSubscription
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
        json
    );
}

function suspensionDetails(json: TSuspensionDetails): SuspensionDetails {
    return {
        reason: json.reason,
        action: suspensionAction(json.action),
        suspendedBy: bytesToHexString(json.suspended_by),
    };
}

function suspensionAction(json: TSuspensionAction): SuspensionAction {
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

export function checkUsernameResponse(json: userIndexCheckUsernameResponse): CheckUsernameResponse {
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

export function setUsernameResponse(json: userIndexSetUsernameResponse): SetUsernameResponse {
    if (json === "Success") {
        return "success";
    }
    if (json === "UsernameTaken") {
        return "username_taken";
    }
    if (json === "UserNotFound") {
        return "user_not_found";
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
    throw new UnsupportedValueError("Unexpected SetUsernameResponse type received", json);
}

export function setDisplayNameResponse(
    json: userIndexSetDisplayNameResponse
): SetDisplayNameResponse {
    if (json === "Success") {
        return "success";
    }
    if (json === "UserNotFound") {
        return "user_not_found";
    }
    if (json === "DisplayNameInvalid") {
        return "display_name_invalid";
    }
    if (json === "Unauthorized") {
        return "unauthorized";
    }
    if ("DisplayNameTooShort" in json) {
        return "display_name_too_short";
    }
    if ("DisplayNameTooLong" in json) {
        return "display_name_too_long";
    }
    throw new UnsupportedValueError("Unexpected SetDisplayNameResponse type received", json);
}

export function suspendUserResponse(json: userIndexSuspendUserResponse): SuspendUserResponse {
    if (json === "Success") {
        return "success";
    }
    if (json === "UserAlreadySuspended") {
        return "user_already_suspended";
    }
    if (json === "UserNotFound") {
        return "user_not_found";
    }
    if ("InternalError" in json) {
        return "internal_error";
    }
    throw new UnsupportedValueError("Unexpected SuspendUserResponse type received", json);
}

export function unsuspendUserResponse(json: userIndexUnsuspendUserResponse): UnsuspendUserResponse {
    if (json === "Success") {
        return "success";
    }
    if (json === "UserNotFound") {
        return "user_not_found";
    }
    if (json === "UserNotSuspended") {
        return "user_not_suspended";
    }
    if ("InternalError" in json) {
        return "internal_error";
    }
    throw new UnsupportedValueError("Unexpected UnsuspendUserResponse type received", json);
}

export function payForDiamondMembershipResponse(
    duration: DiamondMembershipDuration,
    json: userIndexPayForDiamondMembershipResponse
): PayForDiamondMembershipResponse {
    if (json === "PaymentAlreadyInProgress") {
        return { kind: "payment_already_in_progress" };
    }
    if (json === "CurrencyNotSupported") {
        return { kind: "currency_not_supported" };
    }
    if (json === "UserNotFound") {
        return { kind: "user_not_found" };
    }
    if (json === "PriceMismatch") {
        return { kind: "price_mismatch" };
    }
    if (json === "AlreadyLifetimeDiamondMember") {
        return { kind: "already_lifetime_diamond_member" };
    }
    if ("Success" in json) {
        return {
            kind: "success",
            proof: json.Success.proof_jwt,
            status:
                duration === "lifetime"
                    ? { kind: "lifetime" }
                    : { kind: "active", ...diamondMembership(json.Success) },
        };
    }
    if ("TransferFailed" in json) {
        return { kind: "transfer_failed" };
    }
    if ("InternalError" in json) {
        return { kind: "internal_error" };
    }
    if ("InsufficientFunds" in json) {
        return { kind: "insufficient_funds" };
    }
    throw new UnsupportedValueError(
        "Unexpected ApiPayForDiamondMembershipResponse type received",
        json
    );
}

export function apiJsonDiamondDuration(
    domain: DiamondMembershipDuration
): TDiamondMembershipPlanDuration {
    if (domain === "one_month") {
        return "OneMonth";
    }
    if (domain === "three_months") {
        return "ThreeMonths";
    }
    if (domain === "one_year") {
        return "OneYear";
    }
    if (domain === "lifetime") {
        return "Lifetime";
    }
    throw new UnsupportedValueError("Unexpected DiamondMembershipDuration type received", domain);
}

export function diamondMembershipFeesResponse(
    json: userIndexDiamondMembershipFeesResponse
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

export function chitLeaderboardResponse(json: userIndexChitLeaderboardResponse): ChitUserBalance[] {
    if ("Success" in json) {
        return json.Success.map(chitUserBalance);
    }
    throw new UnsupportedValueError("Unexpected ChitLeaderboardResponse type received", json);
}

function chitUserBalance(json: userIndexChitLeaderboardChitUserBalance): ChitUserBalance {
    return {
        userId: bytesToHexString(json.user_id),
        balance: json.balance,
        username: json.username,
    };
}

export function submitProofOfUniquePersonhoodResponse(
    json: userIndexSubmitProofOfUniquePersonhoodResponse
): SubmitProofOfUniquePersonhoodResponse {
    if (json === "Success") {
        return CommonResponses.success();
    }
    if (json === "UserNotFound") {
        return CommonResponses.userNotFound();
    }
    if ("Invalid" in json) {
        return CommonResponses.invalid();
    }
    throw new UnsupportedValueError(
        "Unexpected SubmitProofOfUniquePersonhoodResponse type received",
        json
    );
}
