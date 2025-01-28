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
    ExternalAchievementsResponse,
    ExternalAchievement,
    ChitLeaderboardResponse,
    ExploreBotsResponse,
    SlashCommandSchema,
    BotMatch,
    SlashCommandParam,
    BotsResponse,
    ExternalBot,
} from "openchat-shared";
import { CommonResponses, UnsupportedValueError } from "openchat-shared";
import {
    bytesToHexString,
    identity,
    mapOptional,
    principalBytesToString,
} from "../../utils/mapping";
import {
    apiChatPermission,
    apiCommunityPermission,
    apiMessagePermission,
    externalBotCommand,
    externalBotDefinition,
    token,
} from "../common/chatMappersV2";
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
    UserIndexExternalAchievementsResponse,
    UserIndexExternalAchievementsExternalAchievement,
    UserIndexExploreBotsResponse,
    BotMatch as ApiBotMatch,
    SlashCommandSchema as ApiSlashCommandSchema,
    SlashCommandParam as ApiSlashCommandParam,
    SlashCommandParamType as ApiSlashCommandParamType,
    UserIndexBotUpdatesResponse,
    UserIndexBotUpdatesBotSchema,
} from "../../typebox";
import { toRecord } from "../../utils/list";

export function botUpdatesResponse(
    value: UserIndexBotUpdatesResponse,
    current: BotsResponse | undefined,
    blobUrlPattern: string,
    canisterId: string,
): BotsResponse {
    if (value === "SuccessNoUpdates") {
        return current ?? { timestamp: 0n, bots: [] };
    }
    if ("Success" in value) {
        const map = toRecord(current?.bots ?? [], (b) => b.id);
        value.Success.removed.forEach((d) => {
            delete map[principalBytesToString(d)];
        });
        return {
            timestamp: 0n,
            bots: Object.values(
                value.Success.added_or_updated.reduce((all, bot) => {
                    const mapped = botSchema(bot, blobUrlPattern, canisterId);
                    all[mapped.id] = mapped;
                    return all;
                }, map),
            ),
        };
    }
    throw new UnsupportedValueError("Unexpected UserIndexBotUpdatesResponse received", value);
}

export function botSchema(
    bot: UserIndexBotUpdatesBotSchema,
    blobUrlPattern: string,
    canisterId: string,
): ExternalBot {
    const botId = principalBytesToString(bot.id);
    return {
        kind: "external_bot",
        id: botId,
        name: bot.name,
        avatarUrl: mapOptional(
            bot.avatar_id,
            (id) =>
                `${blobUrlPattern
                    .replace("{canisterId}", canisterId)
                    .replace("{blobType}", "avatar")}/${botId}/${id}`,
        ),
        ownerId: principalBytesToString(bot.owner),
        endpoint: bot.endpoint,
        definition: {
            kind: "bot_definition",
            description: bot.description,
            commands: bot.commands.map(externalBotCommand),
        },
    };
}

export function userSearchResponse(value: UserIndexSearchResponse): UserSummary[] {
    if ("Success" in value) {
        const timestamp = value.Success.timestamp;
        return value.Success.users.map((u) => userSummary(u, timestamp));
    }
    throw new Error(`Unknown UserIndex.SearchResponse of ${value}`);
}

export function usersApiResponse(value: UserIndexUsersResponse): UsersApiResponse {
    if ("Success" in value) {
        const timestamp = value.Success.timestamp;
        return {
            serverTimestamp: timestamp,
            users: value.Success.users.map(userSummaryUpdate),
            deletedUserIds: new Set(value.Success.deleted.map(principalBytesToString)),
            currentUser: mapOptional(value.Success.current_user, (u) =>
                currentUserSummary(u, timestamp),
            ),
        };
    }
    throw new Error(`Unknown UserIndex.UsersResponse of ${value}`);
}

export function currentUserSummary(
    value: TCurrentUserSummary,
    timestamp: bigint,
): CurrentUserSummary {
    return {
        kind: "current_user_summary",
        username: value.username,
        isPlatformOperator: value.is_platform_operator,
        diamondStatus: diamondMembershipStatus(value.diamond_membership_status),
        userId: principalBytesToString(value.user_id),
        isBot: value.is_bot,
        displayName: mapOptional(value.display_name, identity),
        moderationFlagsEnabled: value.moderation_flags_enabled,
        isSuspectedBot: value.is_suspected_bot,
        suspensionDetails: mapOptional(value.suspension_details, suspensionDetails),
        isPlatformModerator: value.is_platform_moderator,
        diamondDetails: mapOptional(value.diamond_membership_details, diamondMembership),
        updated: timestamp,
        blobReference: mapOptional(value.avatar_id, (id) => ({
            blobId: id,
            canisterId: principalBytesToString(value.user_id),
        })),
        isUniquePerson: value.is_unique_person,
    };
}

export function userSummaryUpdate(value: TUserSummaryV2): UserSummaryUpdate {
    return {
        userId: principalBytesToString(value.user_id),
        stable: mapOptional(value.stable, (s) => ({
            username: s.username,
            diamondStatus: diamondStatus(s.diamond_membership_status),
            isBot: s.is_bot,
            displayName: mapOptional(s.display_name, identity),
            blobReference: mapOptional(s.avatar_id, (id) => ({
                blobId: id,
                canisterId: principalBytesToString(value.user_id),
            })),
            suspended: s.suspended,
            isUniquePerson: s.is_unique_person,
        })),
        volatile: mapOptional(value.volatile, (v) => ({
            chitBalance: v.chit_balance,
            streak: v.streak,
            totalChitEarned: v.total_chit_earned,
        })),
    };
}

export function userSummary(value: TUserSummary, timestamp: bigint): UserSummary {
    return {
        kind: value.is_bot ? "bot" : "user",
        userId: principalBytesToString(value.user_id),
        username: value.username,
        displayName: mapOptional(value.display_name, identity),
        blobReference: mapOptional(value.avatar_id, (id) => ({
            blobId: id,
            canisterId: principalBytesToString(value.user_id),
        })),
        updated: timestamp,
        suspended: value.suspended,
        diamondStatus: diamondStatus(value.diamond_membership_status),
        chitBalance: value.chit_balance,
        totalChitEarned: value.total_chit_earned,
        streak: value.streak,
        isUniquePerson: value.is_unique_person,
    };
}

export function diamondStatus(value: TDiamondMembershipStatus): DiamondMembershipStatus["kind"] {
    if (value === "Inactive") {
        return "inactive";
    }
    if (value === "Active") {
        return "active";
    }
    if (value === "Lifetime") {
        return "lifetime";
    }
    throw new UnsupportedValueError("Unexpected DiamondMembershipStatus type received", value);
}

export function userRegistrationCanisterResponse(
    value: UserIndexUserRegistrationCanisterResponse,
): string {
    if (value !== "NewRegistrationsClosed" && "Success" in value) {
        return principalBytesToString(value.Success);
    }
    throw new Error(`Unexpected UserRegistrationCanisterResponse type received: ${value}`);
}

export function currentUserResponse(value: UserIndexCurrentUserResponse): CurrentUserResponse {
    if (value === "UserNotFound") {
        return { kind: "unknown_user" };
    }

    if ("Success" in value) {
        const r = value.Success;

        console.log("User: ", r);
        return {
            kind: "created_user",
            userId: principalBytesToString(r.user_id),
            username: r.username,
            dateCreated: r.date_created,
            displayName: r.display_name ?? undefined,
            cryptoAccount: bytesToHexString(r.icp_account),
            isPlatformModerator: r.is_platform_moderator,
            isPlatformOperator: r.is_platform_operator,
            suspensionDetails: mapOptional(r.suspension_details, suspensionDetails),
            isSuspectedBot: r.is_suspected_bot,
            diamondStatus: diamondMembershipStatus(r.diamond_membership_status),
            moderationFlagsEnabled: r.moderation_flags_enabled,
            isBot: false,
            updated: BigInt(Date.now()),
            isUniquePerson: value.Success.is_unique_person,
        };
    }

    throw new Error(`Unexpected CurrentUserResponse type received: ${value}`);
}

function diamondMembershipStatus(value: TDiamondMembershipStatusFull): DiamondMembershipStatus {
    if (value === "Inactive") {
        return { kind: "inactive" };
    }
    if (value === "Lifetime") {
        return { kind: "lifetime" };
    }
    if ("Active" in value) {
        return {
            kind: "active",
            ...diamondMembership(value.Active),
        };
    }
    throw new UnsupportedValueError(
        "Unexpected DiamondMembershipStatusFullJson type received",
        value,
    );
}

function diamondMembership(value: TDiamondMembershipDetails): DiamondMembershipDetails {
    return {
        expiresAt: value.expires_at,
        subscription: diamondMembershipSubscription(value.subscription),
        payInChat: value.pay_in_chat,
    };
}

function diamondMembershipSubscription(
    value: TDiamondMembershipSubscription,
): DiamondMembershipSubscription {
    if (value === "OneMonth") {
        return "one_month";
    }
    if (value === "ThreeMonths") {
        return "three_months";
    }
    if (value === "OneYear") {
        return "one_year";
    }
    if (value === "Disabled") {
        return "disabled";
    }
    throw new UnsupportedValueError(
        "Unexpected DiamondMembershipSubscriptionJson type received",
        value,
    );
}

function suspensionDetails(value: TSuspensionDetails): SuspensionDetails {
    return {
        reason: value.reason,
        action: suspensionAction(value.action),
        suspendedBy: principalBytesToString(value.suspended_by),
    };
}

function suspensionAction(value: TSuspensionAction): SuspensionAction {
    if ("Unsuspend" in value) {
        return {
            kind: "unsuspend_action",
            timestamp: value.Unsuspend,
        };
    } else if ("Delete" in value) {
        return {
            kind: "delete_action",
            timestamp: value.Delete,
        };
    }

    throw new Error(`Unexpected SuspensionAction type received: ${value}`);
}

export function checkUsernameResponse(
    value: UserIndexCheckUsernameResponse,
): CheckUsernameResponse {
    if (value === "Success") {
        return "success";
    }
    if (value === "UsernameTaken") {
        return "username_taken";
    }
    if (value === "UsernameInvalid") {
        return "username_invalid";
    }
    if ("UsernameTooShort" in value) {
        return "username_too_short";
    }
    if ("UsernameTooLong" in value) {
        return "username_too_long";
    }
    throw new UnsupportedValueError("Unexpected CheckUsernameResponse type received", value);
}

export function setUsernameResponse(value: UserIndexSetUsernameResponse): SetUsernameResponse {
    if (value === "Success") {
        return "success";
    }
    if (value === "UsernameTaken") {
        return "username_taken";
    }
    if (value === "UserNotFound") {
        return "user_not_found";
    }
    if (value === "UsernameInvalid") {
        return "username_invalid";
    }
    if ("UsernameTooShort" in value) {
        return "username_too_short";
    }
    if ("UsernameTooLong" in value) {
        return "username_too_long";
    }
    throw new UnsupportedValueError("Unexpected SetUsernameResponse type received", value);
}

export function setDisplayNameResponse(
    value: UserIndexSetDisplayNameResponse,
): SetDisplayNameResponse {
    if (value === "Success") {
        return "success";
    }
    if (value === "UserNotFound") {
        return "user_not_found";
    }
    if (value === "DisplayNameInvalid") {
        return "display_name_invalid";
    }
    if ("DisplayNameTooShort" in value) {
        return "display_name_too_short";
    }
    if ("DisplayNameTooLong" in value) {
        return "display_name_too_long";
    }
    throw new UnsupportedValueError("Unexpected SetDisplayNameResponse type received", value);
}

export function suspendUserResponse(value: UserIndexSuspendUserResponse): SuspendUserResponse {
    if (value === "Success") {
        return "success";
    }
    if (value === "UserAlreadySuspended") {
        return "user_already_suspended";
    }
    if (value === "UserNotFound") {
        return "user_not_found";
    }
    if ("InternalError" in value) {
        return "internal_error";
    }
    throw new UnsupportedValueError("Unexpected SuspendUserResponse type received", value);
}

export function unsuspendUserResponse(
    value: UserIndexUnsuspendUserResponse,
): UnsuspendUserResponse {
    if (value === "Success") {
        return "success";
    }
    if (value === "UserNotFound") {
        return "user_not_found";
    }
    if (value === "UserNotSuspended") {
        return "user_not_suspended";
    }
    if ("InternalError" in value) {
        return "internal_error";
    }
    throw new UnsupportedValueError("Unexpected UnsuspendUserResponse type received", value);
}

export function payForDiamondMembershipResponse(
    duration: DiamondMembershipDuration,
    value: UserIndexPayForDiamondMembershipResponse,
): PayForDiamondMembershipResponse {
    if (value === "PaymentAlreadyInProgress") {
        return { kind: "payment_already_in_progress" };
    }
    if (value === "CurrencyNotSupported") {
        return { kind: "currency_not_supported" };
    }
    if (value === "UserNotFound") {
        return { kind: "user_not_found" };
    }
    if (value === "PriceMismatch") {
        return { kind: "price_mismatch" };
    }
    if (value === "AlreadyLifetimeDiamondMember") {
        return { kind: "already_lifetime_diamond_member" };
    }
    if ("Success" in value) {
        return {
            kind: "success",
            proof: value.Success.proof_jwt,
            status:
                duration === "lifetime"
                    ? { kind: "lifetime" }
                    : { kind: "active", ...diamondMembership(value.Success) },
        };
    }
    if ("TransferFailed" in value) {
        return { kind: "transfer_failed" };
    }
    if ("InternalError" in value) {
        return { kind: "internal_error" };
    }
    if ("InsufficientFunds" in value) {
        return { kind: "insufficient_funds" };
    }
    throw new UnsupportedValueError(
        "Unexpected ApiPayForDiamondMembershipResponse type received",
        value,
    );
}

export function apiJsonDiamondDuration(
    domain: DiamondMembershipDuration,
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
    value: UserIndexDiamondMembershipFeesResponse,
): DiamondMembershipFees[] {
    if ("Success" in value) {
        return value.Success.map((f) => ({
            token: token(f.token) as "CHAT" | "ICP",
            oneMonth: f.one_month,
            threeMonths: f.three_months,
            oneYear: f.one_year,
            lifetime: f.lifetime,
        }));
    }
    throw new UnsupportedValueError(
        "Unexpected DiamondMembershipFeesResponse type received",
        value,
    );
}

export function chitLeaderboardResponse(
    value: UserIndexChitLeaderboardResponse,
): ChitLeaderboardResponse {
    if ("SuccessV2" in value) {
        return {
            allTime: value.SuccessV2.all_time.map(chitUserBalance),
            lastMonth: value.SuccessV2.last_month.map(chitUserBalance),
            thisMonth: value.SuccessV2.this_month.map(chitUserBalance),
        };
    }
    throw new UnsupportedValueError("Unexpected ChitLeaderboardResponse type received", value);
}

function chitUserBalance(value: UserIndexChitLeaderboardChitUserBalance): ChitUserBalance {
    return {
        userId: principalBytesToString(value.user_id),
        balance: value.balance,
        username: value.username,
    };
}

export function submitProofOfUniquePersonhoodResponse(
    value: UserIndexSubmitProofOfUniquePersonhoodResponse,
): SubmitProofOfUniquePersonhoodResponse {
    if (value === "Success") {
        return CommonResponses.success();
    }
    if (value === "UserNotFound") {
        return CommonResponses.userNotFound();
    }
    if ("Invalid" in value) {
        return CommonResponses.invalid();
    }
    throw new UnsupportedValueError(
        "Unexpected SubmitProofOfUniquePersonhoodResponse type received",
        value,
    );
}

export function externalAchievementsResponse(
    value: UserIndexExternalAchievementsResponse,
): ExternalAchievementsResponse {
    if (value === "SuccessNoUpdates") {
        return { kind: "success_no_updates" };
    }
    if ("Success" in value) {
        return {
            kind: "success",
            addedOrUpdated: value.Success.added_or_updated.map(externalAchievement),
            lastUpdated: value.Success.last_updated,
        };
    }
    throw new UnsupportedValueError("Unexpected ExternalAchievementsResponse type received", value);
}

function externalAchievement(
    value: UserIndexExternalAchievementsExternalAchievement,
): ExternalAchievement {
    return {
        id: value.id,
        url: value.url,
        name: value.name,
        chitReward: value.chit_reward,
        expires: value.expires,
        budgetExhausted: value.budget_exhausted,
    };
}

export function apiCustomParamFields(param: SlashCommandParam): ApiSlashCommandParamType {
    switch (param.kind) {
        case "user":
            return "UserParam";
        case "boolean":
            return "BooleanParam";
        case "integer":
            return {
                IntegerParam: {
                    min_value: param.minValue,
                    max_value: param.maxValue,
                    choices: param.choices.map((c) => ({
                        name: c.name,
                        value: c.value,
                    })),
                },
            };
        case "decimal":
            return {
                DecimalParam: {
                    min_value: param.minValue,
                    max_value: param.maxValue,
                    choices: param.choices,
                },
            };
        case "string":
            return {
                StringParam: {
                    min_length: param.minLength,
                    max_length: param.maxLength,
                    choices: param.choices,
                },
            };
    }
}

export function apiExternalBotParam(param: SlashCommandParam): ApiSlashCommandParam {
    return {
        ...param,
        param_type: apiCustomParamFields(param),
    };
}

export function apiExternalBotCommand(command: SlashCommandSchema): ApiSlashCommandSchema {
    return {
        name: command.name,
        description: command.description,
        placeholder: command.placeholder,
        params: command.params.map(apiExternalBotParam),
        permissions: {
            chat: command.permissions.chatPermissions.map(apiChatPermission),
            community: command.permissions.communityPermissions.map(apiCommunityPermission),
            message: command.permissions.messagePermissions.map(apiMessagePermission),
        },
    };
}

export function externalBotMatch(
    match: ApiBotMatch,
    blobUrlPattern: string,
    canisterId: string,
): BotMatch {
    const botId = principalBytesToString(match.id);
    return {
        name: match.name,
        avatarUrl: mapOptional(
            match.avatar_id,
            (id) =>
                `${blobUrlPattern
                    .replace("{canisterId}", canisterId)
                    .replace("{blobType}", "avatar")}/${botId}/${id}`,
        ),
        id: botId,
        ownerId: principalBytesToString(match.owner),
        definition: externalBotDefinition(match),
    };
}

export function exploreBotsResponse(
    value: UserIndexExploreBotsResponse,
    blobUrlPattern: string,
    canisterId: string,
): ExploreBotsResponse {
    if (value === "InvalidTerm") {
        return { kind: "term_invalid" };
    }
    if ("TermTooLong" in value) {
        return { kind: "term_invalid" };
    }
    if ("TermTooShort" in value) {
        return { kind: "term_invalid" };
    }
    if ("Success" in value) {
        return {
            kind: "success",
            matches: value.Success.matches.map((m) =>
                externalBotMatch(m, blobUrlPattern, canisterId),
            ),
            total: value.Success.total,
        };
    }
    throw new UnsupportedValueError("Unexpected ExploreBotsResponse type received", value);
}
