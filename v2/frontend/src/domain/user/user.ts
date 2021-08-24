export type UserLastOnline = {
    userId: string;
    secondsSinceLastOnline: number;
};

export type UserSummary = UserLastOnline & {
    username: string;
};

export type PartialUserSummary = UserLastOnline & {
    username?: string;
};

export type UserLookup = Record<string, PartialUserSummary>;

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
    users: PartialUserSummary[];
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
}

export type PhoneNumber = {
    countryCode: number;
    number: string;
};

export type CreateCanisterResponse =
    | "success"
    | "user_already_created"
    | "creation_in_progress"
    | "internal_error"
    | "user_unconfirmed"
    | "user_not_found";

export type UpgradeCanisterResponse =
    | "upgrade_in_progress"
    | "user_not_created"
    | "success"
    | "upgrade_not_required"
    | "internal_error"
    | "user_not_found";

export type CurrentUserResponse =
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
    canisterUpgradeStatus: "required" | "not_required" | "in_progress";
};

export type UserNotFound = {
    kind: "unknown_user";
};

export type SetUsernameResponse =
    | "success"
    | "no_change"
    | "username_taken"
    | "user_not_found"
    | "user_unconfirmed"
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
