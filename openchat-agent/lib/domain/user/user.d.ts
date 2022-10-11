import type { Version } from "../../domain/version";
import type { DataContent } from "../data/data";
export declare type UserLastOnline = {
    kind: "user" | "bot";
    userId: string;
    lastOnline: number;
    updated: bigint;
};
export declare type UserSummary = UserLastOnline & DataContent & {
    username: string;
};
export declare type PartialUserSummary = UserLastOnline & DataContent & {
    username?: string;
};
export declare type UserLookup = Record<string, PartialUserSummary>;
export declare type User = {
    userId: string;
    username: string;
};
export declare type PublicProfile = {
    username: string;
    avatarId?: bigint;
    bio: string;
    isPremium: boolean;
    phoneIsVerified: boolean;
    created: bigint;
};
export declare type UsersArgs = {
    userGroups: {
        users: string[];
        updatedSince: bigint;
    }[];
};
export declare type UsersResponse = {
    serverTimestamp?: bigint;
    users: PartialUserSummary[];
};
export declare enum UserStatus {
    Offline = 0,
    Online = 1,
    None = 2
}
export declare enum AvatarSize {
    Miniscule = 0,
    Tiny = 1,
    Small = 2,
    Medium = 3,
    Large = 4,
    ExtraLarge = 5
}
export declare type CreateChallengeResponse = Challenge | Throttled;
export declare type Challenge = {
    kind: "challenge";
    key: number;
    pngBase64: string;
};
export declare type Throttled = {
    kind: "throttled";
};
export declare type ChallengeAttempt = {
    key: number;
    chars: string;
};
export declare type PhoneNumber = {
    countryCode: number;
    number: string;
};
export declare type CurrentUserResponse = CreatedUser | UserNotFound;
export declare type UpgradeInProgress = {
    kind: "upgrade_in_progress";
};
export declare type PhoneStatus = {
    kind: "confirmed";
} | {
    kind: "none";
} | {
    kind: "unconfirmed";
    validUntil: number;
    phoneNumber: PhoneNumber;
};
export declare type CreatedUser = {
    kind: "created_user";
    username: string;
    cryptoAccount: string;
    phoneStatus: PhoneStatus;
    userId: string;
    canisterUpgradeStatus: "required" | "not_required" | "in_progress";
    wasmVersion: Version;
    openStorageLimitBytes: number;
    referrals: string[];
};
export declare type UserNotFound = {
    kind: "unknown_user";
};
export declare type CheckUsernameResponse = "success" | "username_taken" | "username_too_short" | "username_too_long" | "username_invalid";
export declare type SetUsernameResponse = "success" | "username_taken" | "user_not_found" | "username_too_short" | "username_too_long" | "username_invalid";
export declare type SubmitPhoneNumberResponse = "success" | "already_registered" | "already_registered_by_other" | "invalid_phone_number" | "user_not_found";
export declare type ConfirmPhoneNumberResponse = {
    kind: "success";
    storageLimitBytes: number;
} | {
    kind: "already_claimed";
} | {
    kind: "code_incorrect";
} | {
    kind: "code_expired";
} | {
    kind: "not_found";
} | {
    kind: "phone_number_not_submitted";
};
export declare type ResendCodeResponse = "success" | "phone_number_already_confirmed" | "user_not_found" | "phone_number_not_submitted";
export declare type InvalidCurrency = {
    kind: "invalid_currency";
};
export declare type SetBioResponse = "success" | "bio_too_long";
export declare type RegisterUserResponse = "user_limit_reached" | "success" | "not_supported" | "already_registered" | "username_taken" | "internal_error" | "cycles_balance_too_low" | "username_too_short" | "username_too_long" | "username_invalid" | "challenge_failed";
export declare type UpgradeStorageResponse = {
    kind: "success_no_change";
} | {
    kind: "success";
} | {
    kind: "payment_not_found";
} | {
    kind: "payment_insufficient";
    ammountRequirede8s: number;
    accountBalancee8s: number;
} | {
    kind: "internal_error";
} | {
    kind: "storage_limit_exceeded";
} | {
    kind: "user_not_found";
};
export declare type PinChatResponse = {
    kind: "success";
} | {
    kind: "pinned_limit_reached";
    limit: number;
};
export declare type UnpinChatResponse = "success";
export declare type ArchiveChatResponse = "chat_not_found" | "success";
export declare type MigrateUserPrincipalResponse = "success" | "principal_already_in_use" | "migration_already_in_progress" | "internal_error" | "migration_not_initialized";
