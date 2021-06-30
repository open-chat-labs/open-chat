export type User = {
    username: string;
};

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
