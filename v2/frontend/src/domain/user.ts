import type { Principal } from "@dfinity/principal";

export type User = {
    userId: Principal;
    username: string;
    accountBalance: bigint;
};

export function avatarUrl(user: User): string {
    // todo - we will use a dummy avatar url for the time being
    return "https://i.pravatar.cc/300";
    const url = new URL(window.location.toString());
    return `${url.protocol}//${user.userId}${url.host}/avatar`;
}

export enum UserStatus {
    Offline,
    Online,
    Busy,
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
    timeUntilResendCodePermitted: bigint;
    phoneNumber: PhoneNumber;
};

export type ConfirmedUser = {
    kind: "confirmed_user";
    canisterCreationInProgress: boolean;
    username: string;
};

export type ConfirmedPendingUsername = {
    kind: "confirmed_pending_username";
    canisterCreationInProgress: boolean;
};

export type CreatedUser = {
    kind: "created_user";
    username: string;
    userId: Principal;
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
    | AlreadyRegisteredButUnclaimed
    | InvalidPhoneNumber;

export type RegisterSuccess = { kind: "success" };
export type AlreadyRegistered = { kind: "already_registered" };
export type AlreadyRegisteredByOther = { kind: "already_registered_by_other" };
export type AlreadyRegisteredButUnclaimed = { kind: "already_registered_but_unclaimed" };
export type InvalidPhoneNumber = { kind: "invalid_phone_number" };

export type ConfirmPhoneNumberResponse =
    | "success"
    | "already_claimed"
    | "code_incorrect"
    | "code_expired"
    | "not_found";

export type ResendCodeResponse =
    | ResendSuccess
    | ResendAlreadyClaimed
    | CodeNotExpiredYet
    | NotFound;

export type ResendSuccess = { kind: "success" };
export type ResendAlreadyClaimed = { kind: "already_claimed" };
export type CodeNotExpiredYet = { kind: "not_expired"; timeUntilResendPermitted: number };
export type NotFound = { kind: "not_found" };
