import type {
    SetUsernameResponse,
    CurrentUserResponse,
    ConfirmPhoneNumberResponse,
    SubmitPhoneNumberResponse,
    PhoneNumber,
    ResendCodeResponse,
    UsersArgs,
    UsersResponse,
    UserSummary,
    UpgradeCanisterResponse,
    CreateCanisterResponse,
    RegistrationFeeResponse,
    FeeCurrency,
} from "../../domain/user/user";

export interface IUserIndexClient {
    createCanister: () => Promise<CreateCanisterResponse>;
    upgradeUser: () => Promise<UpgradeCanisterResponse>;
    getCurrentUser: () => Promise<CurrentUserResponse>;
    setUsername(username: string): Promise<SetUsernameResponse>;
    submitPhoneNumber(phoneNumber: PhoneNumber): Promise<SubmitPhoneNumberResponse>;
    resendRegistrationCode(): Promise<ResendCodeResponse>;
    confirmPhoneNumber(code: string): Promise<ConfirmPhoneNumberResponse>;
    getUsers(users: UsersArgs): Promise<UsersResponse>;
    searchUsers(searchTerm: string, maxResults?: number): Promise<UserSummary[]>;
    generateRegistrationFee(currency: FeeCurrency): Promise<RegistrationFeeResponse>;
}
