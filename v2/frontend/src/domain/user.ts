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
