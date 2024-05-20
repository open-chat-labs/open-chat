import type { PinNumberFailures } from "../chat";
import type { DataContent } from "../data/data";
import type {
    Failure,
    InternalError,
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
    streak: number;
};

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

export type IdentityState =
    | { kind: "anon" }
    | { kind: "loading_user" }
    | { kind: "logged_in" }
    | { kind: "registering" }
    | { kind: "logging_in" }
    | { kind: "upgrading_user" }
    | { kind: "upgrade_user" };

export type UserLookup = Record<string, UserSummary>;

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

export function anonymousUser(): CreatedUser {
    return {
        kind: "created_user",
        username: ANON_USERNAME,
        dateCreated: BigInt(0),
        displayName: ANON_DISPLAY_NAME, // TODO probably need to translate this
        cryptoAccount: "", // TODO - will this be a problem?
        userId: ANON_USER_ID,
        canisterUpgradeStatus: "not_required",
        referrals: [],
        isPlatformModerator: false,
        isPlatformOperator: false,
        suspensionDetails: undefined,
        isSuspectedBot: false,
        diamondStatus: { kind: "inactive" },
        moderationFlagsEnabled: 0,
        chitBalance: 0,
        streak: 0,
        nextDailyChitClaim: 0n,
    };
}

export type CreatedUser = {
    kind: "created_user";
    username: string;
    dateCreated: bigint;
    displayName: string | undefined;
    cryptoAccount: string;
    userId: string;
    canisterUpgradeStatus: "required" | "not_required" | "in_progress";
    referrals: string[];
    isPlatformModerator: boolean;
    isPlatformOperator: boolean;
    suspensionDetails: SuspensionDetails | undefined;
    isSuspectedBot: boolean;
    diamondStatus: DiamondMembershipStatus;
    moderationFlagsEnabled: number;
    chitBalance: number;
    streak: number;
    nextDailyChitClaim: bigint;
};

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
    | "offline"
    | "unauthorized";

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
    | { kind: "success"; status: DiamondMembershipStatus }
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

export type ReferralLeaderboardRange = { year: number; month: number };

export type ReferralLeaderboardResponse = AllTimeReferralStats | MonthlyReferralStats;

export type AllTimeReferralStats = {
    kind: "all_time";
    stats: ReferralStats[];
};

export type MonthlyReferralStats = {
    kind: "monthly";
    month: number;
    year: number;
    stats: ReferralStats[];
};

export type ReferralStats = {
    username: string;
    totalUsers: number;
    userId: string;
    diamondMembers: number;
    totalRewardsE8s: bigint;
};

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

export type ClaimDailyChitResponse =
    | { kind: "already_claimed"; nextDailyChitClaim: bigint }
    | {
          kind: "success";
          streak: number;
          chitBalance: number;
          chitEarned: number;
          nextDailyChitClaim: bigint;
      };

export type ChitUserBalance = {
    userId: string;
    balance: number;
};
