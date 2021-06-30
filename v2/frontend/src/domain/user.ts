import type { Principal } from "@dfinity/principal";

export type User = {
    userId: Principal;
    username: string;
    version: number;
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

export type GetCurrentUserResponse = UserSuccess | UnknownUser;
export type UserSuccess = { kind: "success"; user: User };
export type UnknownUser = { kind: "unknown" };

export type UpdateUsernameResponse =
    | "success"
    | "no_change"
    | "username_taken"
    | "user_not_found"
    | "username_too_short"
    | "username_too_long";

export type RegisterPhoneNumberResponse =
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
    | ConfirmSuccess
    | ConfirmAlreadyClaimed
    | ConfirmCodeIncorrect
    | ConfirmCodeExpired
    | NotFound;

export type ConfirmSuccess = { kind: "success"; canisterId: Principal };
export type ConfirmAlreadyClaimed = { kind: "already_claimed" };
export type ConfirmCodeIncorrect = { kind: "code_incorrect" };
export type ConfirmCodeExpired = { kind: "code_expired" };
export type NotFound = { kind: "not_found" };

export type ResendCodeResponse =
    | ResendSuccess
    | ResendAlreadyClaimed
    | CodeNotExpiredYet
    | NotFound;

export type ResendSuccess = { kind: "success" };
export type ResendAlreadyClaimed = { kind: "already_claimed" };
export type CodeNotExpiredYet = { kind: "not_expired"; timeUntilResendPermitted: number };
