import type {
    SetUsernameResponse,
    CurrentUserResponse,
    ConfirmPhoneNumberResponse,
    SubmitPhoneNumberResponse,
    PhoneNumber,
    ResendCodeResponse,
    UsersResponse,
    UserSummary,
} from "../../domain/user/user";

export interface IUserIndexClient {
    createCanister: () => Promise<void>;
    upgradeUser: () => Promise<void>;
    getCurrentUser: () => Promise<CurrentUserResponse>;
    setUsername(username: string): Promise<SetUsernameResponse>;
    submitPhoneNumber(phoneNumber: PhoneNumber): Promise<SubmitPhoneNumberResponse>;
    resendRegistrationCode(): Promise<ResendCodeResponse>;
    confirmPhoneNumber(code: string): Promise<ConfirmPhoneNumberResponse>;
    getUsers(userIds: string[], since: bigint): Promise<UsersResponse>;
    searchUsers(searchTerm: string): Promise<UserSummary[]>;
}
