import type { Version } from "../../domain/version";
import type { DataContent } from "../data/data";

export const E8S_PER_ICP = 100_000_000;
export const ICP_TRANSFER_FEE_E8S = BigInt(10_000);

export type UserLastOnline = {
    userId: string;
    lastOnline: number; // timestamp calculated from server response in seconds
    updated: bigint;
};

export type UserSummary = UserLastOnline &
    DataContent & {
        username: string;
    };

// todo - remember why this exists
export type PartialUserSummary = UserLastOnline &
    DataContent & {
        username?: string;
    };

export type UserLookup = Record<string, PartialUserSummary>;

export type User = {
    userId: string;
    username: string;
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
    updated: Set<string>,
};

export enum UserStatus {
    Offline,
    Online,
    None,
}

export enum AvatarSize {
    Tiny,
    Small,
    Medium,
    Large,
    ExtraLarge,
}

export type CreateChallengeResponse = Challenge | Throttled;

export type Challenge = {
    kind: "challenge";
    key: number;
    pngBase64: string;
};

export type Throttled = {
    kind: "throttled";
};

export type ChallengeAttempt = {
    key: number;
    chars: string;
};

export type PhoneNumber = {
    countryCode: number;
    number: string;
};

export type CurrentUserResponse = CreatedUser | UserNotFound;

export type UpgradeInProgress = {
    kind: "upgrade_in_progress";
};

export type PhoneStatus =
    | { kind: "confirmed" }
    | { kind: "none" }
    | { kind: "unconfirmed"; validUntil: number; phoneNumber: PhoneNumber };

export type CreatedUser = {
    kind: "created_user";
    username: string;
    icpAccount: string;
    phoneStatus: PhoneStatus;
    userId: string;
    canisterUpgradeStatus: "required" | "not_required" | "in_progress";
    wasmVersion: Version;
    openStorageLimitBytes: number;
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

export type SubmitPhoneNumberResponse =
    | "success"
    | "already_registered"
    | "already_registered_by_other"
    | "invalid_phone_number"
    | "user_not_found";

export type ConfirmPhoneNumberResponse =
    | { kind: "success"; storageLimitBytes: number }
    | { kind: "already_claimed" }
    | { kind: "code_incorrect" }
    | { kind: "code_expired" }
    | { kind: "not_found" }
    | { kind: "phone_number_not_submitted" };

export type ResendCodeResponse =
    | "success"
    | "phone_number_already_confirmed"
    | "user_not_found"
    | "phone_number_not_submitted";

export type InvalidCurrency = { kind: "invalid_currency" };

export type SetBioResponse = "success" | "bio_too_long";

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
    | "challenge_failed";

export type UpgradeStorageResponse =
    | { kind: "success_no_change" }
    | { kind: "success" }
    | { kind: "payment_not_found" }
    | { kind: "payment_insufficient"; ammountRequirede8s: number; accountBalancee8s: number }
    | { kind: "internal_error" }
    | { kind: "storage_limit_exceeded" }
    | { kind: "user_not_found" };
