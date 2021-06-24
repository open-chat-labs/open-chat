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
