import type { DataContent } from "../data/data";

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
    | "cycles_balance_too_low"
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

export type RegistrationState = PhoneRegistration | CyclesFeeRegistration;

export type PhoneRegistration = {
    kind: "phone_registration";
    phoneNumber: PhoneNumber;
};

export type CyclesFeeRegistration = {
    kind: "cycles_fee_registration";
    amount: bigint;
};

export type UnconfirmedUser = {
    kind: "unconfirmed_user";
    registrationState: RegistrationState;
};

export type ConfirmedUser = {
    kind: "confirmed_user";
    canisterCreationStatus: "in_progress" | "pending";
    username: string;
    registrationState: RegistrationState;
};

export type ConfirmedPendingUsername = {
    kind: "confirmed_pending_username";
    canisterCreationStatus: "in_progress" | "pending" | "created";
    registrationState: RegistrationState;
};

export type CreatedUser = {
    kind: "created_user";
    username: string;
    userId: string;
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
    | UserLimitReached
    | InvalidPhoneNumber;

export type RegisterSuccess = { kind: "success" };
export type AlreadyRegistered = { kind: "already_registered" };
export type AlreadyRegisteredByOther = { kind: "already_registered_by_other" };
export type InvalidPhoneNumber = { kind: "invalid_phone_number" };
export type UserLimitReached = { kind: "user_limit_reached" };

export type ConfirmPhoneNumberResponse =
    | "success"
    | "already_claimed"
    | "code_incorrect"
    | "code_expired"
    | "not_found"
    | "phone_number_not_submitted";

export type ResendCodeResponse =
    | "success"
    | "already_claimed"
    | "user_not_found"
    | "phone_number_not_submitted";

export type RegistrationFeeResponse = AlreadyRegistered | RegistrationFeeSuccess;

export type RegistrationFeeSuccess = {
    kind: "success";
    validUntil: bigint;
    amount: bigint;
};
