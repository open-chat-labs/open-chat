import type { Version } from "../../domain/version";
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
    wasmVersion: Version;
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
    | "user_limit_reached"
    | "success"
    | "not_supported"
    | "already_registered"
    | "username_taken"
    | "internal_error"
    | "cycles_balance_too_low"
    | "username_too_short"
    | "username_too_long"
    | "username_invalid"
    | "public_key_invalid";

export type PinChatResponse = { kind: "success" } | { kind: "pinned_limit_reached"; limit: number };

export type UnpinChatResponse = "success";

export type ArchiveChatResponse = "chat_not_found" | "success";

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
