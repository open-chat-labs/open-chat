import type { Principal } from "@dfinity/principal";

export type UserSummary = {
    userId: string;
    username: string;
    secondsSinceLastOnline: number;
};

export type UserLookup = Record<string, UserSummary>;

export type User = {
    userId: string;
    username: string;
    accountBalance: bigint;
};

export type UsersArgs = {
    users: string[];
    updatedSince?: bigint;
};

export type UsersResponse = {
    timestamp: bigint;
    users: UserSummary[];
};

export function avatarUrl(userId: string): string {
    // todo - we will use a dummy avatar url for the time being
    return "https://i.pravatar.cc/300";
    const url = new URL(window.location.toString());
    return `${url.protocol}//${userId}${url.host}/avatar`;
}

export enum UserStatus {
    Offline,
    Online,
    None,
}

export enum AvatarSize {
    Small,
    Medium,
    Large,
}

export type PhoneNumber = {
    countryCode: number;
    number: string;
};

export function phoneNumberToString({ countryCode, number }: PhoneNumber): string {
    return `(+${countryCode}) ${number}`;
}

export type CurrentUserResponse =
    | UpgradeInProgress
    | UnconfirmedUser
    | ConfirmedUser
    | ConfirmedPendingUsername
    | CreatedUser
    | UserNotFound;

export type UpgradeInProgress = {
    kind: "upgrade_in_progress";
};

export type UnconfirmedUser = {
    kind: "unconfirmed_user";
    phoneNumber: PhoneNumber;
};

export type ConfirmedUser = {
    kind: "confirmed_user";
    canisterCreationStatus: "in_progress" | "pending";
    username: string;
};

export type ConfirmedPendingUsername = {
    kind: "confirmed_pending_username";
    canisterCreationStatus: "in_progress" | "pending" | "created";
};

export type CreatedUser = {
    kind: "created_user";
    username: string;
    userId: string;
    accountBalance: bigint;
    upgradeRequired: boolean;
};

export type UserNotFound = {
    kind: "unknown_user";
};

export type SetUsernameResponse =
    | "success"
    | "no_change"
    | "username_taken"
    | "user_not_found"
    | "username_too_short"
    | "username_too_long"
    | "username_invalid";

export type SubmitPhoneNumberResponse =
    | RegisterSuccess
    | AlreadyRegistered
    | AlreadyRegisteredByOther
    | InvalidPhoneNumber;

export type RegisterSuccess = { kind: "success" };
export type AlreadyRegistered = { kind: "already_registered" };
export type AlreadyRegisteredByOther = { kind: "already_registered_by_other" };
export type InvalidPhoneNumber = { kind: "invalid_phone_number" };

export type ConfirmPhoneNumberResponse =
    | "success"
    | "already_claimed"
    | "code_incorrect"
    | "code_expired"
    | "not_found";

export type ResendCodeResponse = "success" | "already_claimed" | "user_not_found";
