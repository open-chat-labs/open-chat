import type { DataContent } from "../data/data";

export type IdentityState =
    | "requires_login"
    | "loading_user"
    | "logged_in"
    | "registering"
    | "logging_in"
    | "upgrading_user"
    | "upgrade_user";

export type UserCommon = DataContent & {
    kind: "user" | "bot";
    userId: string;
    updated: bigint;
    suspended: boolean;
    diamond: boolean;
};

export type UserSummary = UserCommon & {
    username: string;
};

// todo - remember why this exists
export type PartialUserSummary = UserCommon & {
    username?: string;
};

export type UserLookup = Record<string, PartialUserSummary>;

export type User = {
    userId: string;
    username: string;
};

export type PublicProfile = {
    username: string;
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
    users: PartialUserSummary[];
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

export type UpgradeInProgress = {
    kind: "upgrade_in_progress";
};

export type CreatedUser = {
    kind: "created_user";
    username: string;
    cryptoAccount: string;
    userId: string;
    canisterUpgradeStatus: "required" | "not_required" | "in_progress";
    referrals: string[];
    isPlatformModerator: boolean;
    suspensionDetails: SuspensionDetails | undefined;
    isSuspectedBot: boolean;
    diamondMembership?: DiamondMembershipDetails;
};

export type DiamondMembershipDetails = {
    recurring?: DiamondMembershipDuration;
    expiresAt: bigint;
};

export type DiamondMembershipDuration = "one_month" | "three_months" | "one_year";

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
    | "username_invalid";

export type SetUsernameResponse =
    | "success"
    | "username_taken"
    | "user_not_found"
    | "username_too_short"
    | "username_too_long"
    | "username_invalid";

export type InvalidCurrency = { kind: "invalid_currency" };

export type SetBioResponse = "success" | "bio_too_long" | "user_suspended";

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
    | { kind: "referral_code_expired" };

export type PinChatResponse = "success" | "failure";

export type UnpinChatResponse = "success" | "failure";

export type ArchiveChatResponse = "chat_not_found" | "success";

export type ManageFavouritesResponse = "success" | "failure";

export type MigrateUserPrincipalResponse =
    | "success"
    | "principal_already_in_use"
    | "migration_already_in_progress"
    | "internal_error"
    | "migration_not_initialized";

export type SuspendUserResponse =
    | "success"
    | "user_not_found"
    | "user_already_suspended"
    | "internal_error";

export type UnsuspendUserResponse =
    | "success"
    | "user_not_found"
    | "user_not_suspended"
    | "internal_error";

export type MarkSuspectedBotResponse = "success";

export type PayForDiamondMembershipResponse =
    | { kind: "payment_already_in_progress" }
    | { kind: "currency_not_supported" }
    | { kind: "success"; details: DiamondMembershipDetails }
    | { kind: "price_mismatch" }
    | { kind: "transfer_failed" }
    | { kind: "internal_error" }
    | { kind: "cannot_extend" }
    | { kind: "user_not_found" }
    | { kind: "insufficient_funds" };

export type SetUserUpgradeConcurrencyResponse = "success";

export type SetMessageReminderResponse =
    | "notes_too_long"
    | "success"
    | "reminder_date_in_past"
    | "user_suspended";

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
