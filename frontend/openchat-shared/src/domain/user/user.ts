import type { ChitState, MultiUserChat, PinNumberFailures } from "../chat";
import type { DataContent } from "../data/data";
import type {
    Failure,
    InternalError,
    Invalid,
    Offline,
    Retrying,
    Success,
    TransferFailed,
    UserSuspended,
} from "../response";

export type UserOrUserGroup = UserSummary | UserGroupSummary | MentionEveryone;

export type UserSummary = DataContent & {
    kind: "user" | "bot";
    userId: string;
    username: string;
    displayName: string | undefined;
    updated: bigint;
    suspended: boolean;
    diamondStatus: DiamondMembershipStatus["kind"];
    chitBalance: number;
    totalChitEarned: number;
    streak: number;
    isUniquePerson: boolean;
};

export function deletedUser(userId: string): UserSummary {
    return {
        kind: "user",
        userId,
        username: "Deleted User",
        displayName: undefined,
        updated: BigInt(Number.MAX_VALUE), // we want to *never* request updates for a deleted user
        suspended: false,
        diamondStatus: "inactive",
        chitBalance: 0,
        streak: 0,
        isUniquePerson: false,
        totalChitEarned: 0,
    };
}

// Note this *has* to return UserSummary | undefined because of the types, but we would not expect it to ever do so in practice
export function mergeUserSummaryWithUpdates(
    cached: UserSummary | undefined,
    updates: UserSummaryUpdate,
    timestamp: bigint,
): UserSummary | undefined {
    if (cached === undefined) {
        if (updates.stable === undefined || updates.volatile === undefined) {
            // in this case we cannot construct a valid UserSummary - this should not happen
            return undefined;
        }
        return {
            kind: updates.stable.isBot ? "bot" : "user",
            userId: updates.userId,
            ...updates.stable,
            ...updates.volatile,
            updated: timestamp,
        };
    }
    if (cached.userId !== updates.userId) {
        return undefined;
    }
    return {
        ...cached,
        ...updates.stable,
        ...updates.volatile,
    };
}

// problem - we can no longer create a UserSummary from a CurrentUserSummary
export function userSummaryFromCurrentUserSummary(
    chitState: ChitState,
    currentSummary: CurrentUserSummary,
): UserSummary {
    return {
        kind: currentSummary.isBot ? "bot" : "user",
        userId: currentSummary.userId,
        username: currentSummary.username,
        displayName: currentSummary.displayName,
        updated: currentSummary.updated,
        suspended: currentSummary.suspensionDetails !== undefined,
        diamondStatus: currentSummary.diamondStatus.kind,
        chitBalance: chitState.chitBalance,
        totalChitEarned: chitState.totalChitEarned,
        streak: chitState.streak,
        blobReference: currentSummary.blobReference,
        blobData: currentSummary.blobData,
        blobUrl: currentSummary.blobUrl,
        isUniquePerson: currentSummary.isUniquePerson,
    };
}

export function updateCreatedUser(created: CreatedUser, summary: CurrentUserSummary): CreatedUser {
    return {
        ...created,
        ...summary,
        kind: "created_user",
    };
}

export type UserGroupSummary = {
    kind: "user_group";
    memberCount: number;
    name: string;
    id: number;
};

export type MentionEveryone = {
    kind: "everyone";
};

export type UserGroupDetails = {
    kind: "user_group";
    members: Set<string>;
    id: number;
    name: string;
};

export type PostLoginOperation = CreateCommunity | CreateGroup | JoinCommunity | JoinGroup;

export type CreateCommunity = {
    kind: "create_community";
};

export type CreateGroup = {
    kind: "create_group";
};

export type JoinCommunity = {
    kind: "join_community";
};

export type JoinGroup = {
    kind: "join_group";
    group: MultiUserChat;
    select: boolean;
};

export type IdentityState =
    | { kind: "anon"; postLogin?: PostLoginOperation }
    | { kind: "loading_user"; postLogin?: PostLoginOperation }
    | { kind: "logged_in"; postLogin?: PostLoginOperation }
    | { kind: "registering"; postLogin?: PostLoginOperation }
    | { kind: "logging_in"; postLogin?: PostLoginOperation }
    | { kind: "upgrading_user"; postLogin?: PostLoginOperation }
    | { kind: "upgrade_user"; postLogin?: PostLoginOperation }
    | { kind: "challenging"; postLogin?: PostLoginOperation };

export type UserLookup = Map<string, UserSummary>;

export type User = {
    userId: string;
    username: string;
    displayName: string | undefined;
};

export type PublicProfile = {
    username: string;
    displayName: string | undefined;
    avatarId?: bigint;
    bio: string;
    isPremium: boolean;
    phoneIsVerified: boolean;
    created: bigint;
};

export type UsersArgs = {
    userGroups: {
        users: string[];
        updatedSince: bigint;
    }[];
};

export type UsersResponse = {
    serverTimestamp?: bigint;
    users: UserSummary[];
    deletedUserIds: Set<string>;
    currentUser?: CurrentUserSummary;
};

export type UserSummaryStable = DataContent & {
    username: string;
    diamondStatus: DiamondMembershipStatus["kind"];
    isBot: boolean;
    displayName: string | undefined;
    suspended: boolean;
    isUniquePerson: boolean;
};

export type UserSummaryVolatile = {
    streak: number;
    chitBalance: number;
    totalChitEarned: number;
};

export type UserSummaryUpdate = {
    stable?: UserSummaryStable;
    userId: string;
    volatile?: UserSummaryVolatile;
};

export type UsersApiResponse = {
    serverTimestamp: bigint;
    deletedUserIds: Set<string>;
    users: UserSummaryUpdate[];
    currentUser?: CurrentUserSummary;
};

export enum UserStatus {
    Offline,
    Online,
    None,
}

export enum AvatarSize {
    Tiny,
    Small,
    Default,
    Large,
}

export type CurrentUserResponse = CreatedUser | UserNotFound;

export type CurrentUser = CreatedUser | UserNotFound;

export type UpgradeInProgress = {
    kind: "upgrade_in_progress";
};

export const ANON_USER_ID = "does_this_need_to_be_a_principal";
export const ANON_USERNAME = "guest_user";
export const ANON_DISPLAY_NAME = "Guest user";
export const ANON_AVATAR_URL = "/assets/anon.svg";

type CurrentUserCommon = DataContent & {
    username: string;
    isPlatformOperator: boolean;
    diamondStatus: DiamondMembershipStatus;
    userId: string;
    isBot: boolean;
    displayName: string | undefined;
    moderationFlagsEnabled: number;
    isSuspectedBot: boolean;
    suspensionDetails: SuspensionDetails | undefined;
    isPlatformModerator: boolean;
    diamondDetails?: DiamondMembershipDetails;
    updated: bigint;
    isUniquePerson: boolean;
};

export type CurrentUserSummary = CurrentUserCommon & {
    kind: "current_user_summary";
};

export type CreatedUser = CurrentUserCommon & {
    kind: "created_user";
    dateCreated: bigint;
    cryptoAccount: string;
};

export function anonymousUser(): CreatedUser {
    return {
        kind: "created_user",
        username: ANON_USERNAME,
        dateCreated: BigInt(0),
        displayName: ANON_DISPLAY_NAME, // TODO probably need to translate this
        cryptoAccount: "", // TODO - will this be a problem?
        userId: ANON_USER_ID,
        isPlatformModerator: false,
        isPlatformOperator: false,
        suspensionDetails: undefined,
        isSuspectedBot: false,
        diamondStatus: { kind: "inactive" },
        moderationFlagsEnabled: 0,
        isBot: false,
        updated: 0n,
        isUniquePerson: false,
    };
}

export type DiamondMembershipStatus =
    | { kind: "inactive" }
    | { kind: "lifetime" }
    | ({ kind: "active" } & DiamondMembershipDetails);

export type DiamondMembershipDetails = {
    payInChat: boolean;
    subscription: DiamondMembershipSubscription;
    expiresAt: bigint;
};

export type DiamondMembershipDuration = "one_month" | "three_months" | "one_year" | "lifetime";

export type DiamondMembershipSubscription = "one_month" | "three_months" | "one_year" | "disabled";

export type SuspensionDetails = {
    reason: string;
    action: SuspensionAction;
    suspendedBy: string;
};

export type SuspensionAction = UnsuspendAction | DeleteAction;

export type UnsuspendAction = {
    kind: "unsuspend_action";
    timestamp: bigint;
};

export type DeleteAction = {
    kind: "delete_action";
    timestamp: bigint;
};

export type UserNotFound = {
    kind: "unknown_user";
};

export type CheckUsernameResponse =
    | "success"
    | "username_taken"
    | "username_too_short"
    | "username_too_long"
    | "username_invalid"
    | "offline";

export type SetUsernameResponse =
    | "success"
    | "username_taken"
    | "user_not_found"
    | "username_too_short"
    | "username_too_long"
    | "username_invalid"
    | "offline";

export type SetDisplayNameResponse =
    | "success"
    | "user_not_found"
    | "display_name_too_short"
    | "display_name_too_long"
    | "display_name_invalid"
    | "offline";

export type InvalidCurrency = { kind: "invalid_currency" };

export type SetBioResponse = "success" | "bio_too_long" | "user_suspended" | "offline";

export type RegisterUserResponse =
    | {
          kind: "success";
          userId: string;
          icpAccount: string;
      }
    | { kind: "user_limit_reached" }
    | { kind: "not_supported" }
    | { kind: "already_registered" }
    | { kind: "username_taken" }
    | { kind: "internal_error" }
    | { kind: "cycles_balance_too_low" }
    | { kind: "username_too_short" }
    | { kind: "username_too_long" }
    | { kind: "username_invalid" }
    | { kind: "public_key_invalid" }
    | { kind: "referral_code_invalid" }
    | { kind: "referral_code_already_claimed" }
    | { kind: "referral_code_expired" }
    | { kind: "registration_in_progress" }
    | Offline;

export type PinChatResponse = "success" | "failure" | "offline";

export type UnpinChatResponse = "success" | "failure" | "offline";

export type ArchiveChatResponse = "failure" | "success" | "offline";

export type ManageFavouritesResponse = "success" | "failure" | "offline";

export type SuspendUserResponse =
    | "success"
    | "user_not_found"
    | "user_already_suspended"
    | "internal_error"
    | "offline";

export type UnsuspendUserResponse =
    | "success"
    | "user_not_found"
    | "user_not_suspended"
    | "internal_error"
    | "offline";

export type PayForDiamondMembershipResponse =
    | { kind: "payment_already_in_progress" }
    | { kind: "currency_not_supported" }
    | { kind: "success"; status: DiamondMembershipStatus; proof: string }
    | { kind: "price_mismatch" }
    | { kind: "transfer_failed" }
    | { kind: "internal_error" }
    | { kind: "cannot_extend" }
    | { kind: "user_not_found" }
    | { kind: "insufficient_funds" }
    | { kind: "already_lifetime_diamond_member" }
    | Offline;

export type SetUserUpgradeConcurrencyResponse = "success" | "offline";

export type SetMessageReminderResponse = "failure" | "success" | "offline";

export type ModerationFlag = 1 | 2 | 4;

export const ModerationFlags = {
    Offensive: 1 as ModerationFlag,
    Adult: 2 as ModerationFlag,
    UnderReview: 4 as ModerationFlag,
};

export type NamedAccount = {
    name: string;
    account: string;
};

export type SaveCryptoAccountResponse = { kind: "name_taken" } | Success | Failure;

export type SubmitProposalResponse =
    | Success
    | Retrying
    | UserSuspended
    | GovernanceCanisterNotSupported
    | InsufficientPayment
    | TransferFailed
    | InternalError
    | Offline;

export type GovernanceCanisterNotSupported = {
    kind: "governance_canister_not_supported";
};

export type InsufficientPayment = {
    kind: "insufficient_payment";
};

export type SwapTokensResponse =
    | {
          kind: "success";
          amountOut: bigint;
      }
    | {
          kind: "swap_failed";
      }
    | PinNumberFailures
    | InternalError;

export type Result<T> =
    | {
          kind: "ok";
          value: T;
      }
    | {
          kind: "error";
          error: string;
      };

export type TokenSwapStatusResponse =
    | {
          kind: "success";
          started: bigint;
          depositAccount?: Result<null>;
          transfer?: Result<bigint>;
          notifyDex?: Result<null>;
          amountSwapped?: Result<Result<bigint>>;
          withdrawnFromDex?: Result<bigint>;
      }
    | {
          kind: "not_found";
      };

export type ApproveTransferResponse =
    | Success
    | { kind: "approve_error"; error: string }
    | PinNumberFailures
    | InternalError;

export type DiamondMembershipFees = {
    token: "CHAT" | "ICP";
    oneMonth: bigint;
    threeMonths: bigint;
    oneYear: bigint;
    lifetime: bigint;
};

export type SubmitProofOfUniquePersonhoodResponse = Success | Invalid | UserNotFound;

export type ReferralStatus = "registered" | "diamond" | "unique_person" | "lifetime_diamond";

export type Referral = {
    userId: string;
    status: ReferralStatus;
};
