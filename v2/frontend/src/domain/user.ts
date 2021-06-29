import type { Principal } from "@dfinity/principal";

export type User = {
    userId: Principal;
    username: string;
    version: number;
    accountBalance: bigint;
};

export function avatarUrl(user: User): string {
    return "";
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

export type UserSuccess = {
    kind: "success";
    user: User;
};

export type UnknownUser = {
    kind: "unknown";
};

export type UpdateUsernameResponse =
    | "success"
    | "no_change"
    | "username_taken"
    | "user_not_found"
    | "username_too_short"
    | "username_too_long";
