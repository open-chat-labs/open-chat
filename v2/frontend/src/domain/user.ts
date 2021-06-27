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

export type CreateUserResponse = CreateUserSuccess | UserExists | UserLimitReached;

export type CreateUserSuccess = {
    kind: "success";
    canisterId: string;
};

export type UserExists = { kind: "user_exists" };

export type UserLimitReached = { kind: "user_limit_reached" };
