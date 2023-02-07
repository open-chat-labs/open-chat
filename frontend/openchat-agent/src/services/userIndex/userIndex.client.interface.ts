import type {
    CreateChallengeResponse,
    ChallengeAttempt,
    CheckUsernameResponse,
    CurrentUserResponse,
    ConfirmPhoneNumberResponse,
    SubmitPhoneNumberResponse,
    SetUsernameResponse,
    PhoneNumber,
    ResendCodeResponse,
    UsersArgs,
    UsersResponse,
    UserSummary,
    RegisterUserResponse,
    UpgradeStorageResponse,
    SuspendUserResponse,
    UnsuspendUserResponse,
    MarkSuspectedBotResponse,
    Cryptocurrency,
    DiamondMembershipDuration,
    PayForDiamondMembershipResponse,
} from "openchat-shared";

export interface IUserIndexClient {
    getCurrentUser: () => Promise<CurrentUserResponse>;
    createChallenge: () => Promise<CreateChallengeResponse>;
    registerUser(
        username: string,
        challengeAttempt: ChallengeAttempt,
        referredBy: string | undefined
    ): Promise<RegisterUserResponse>;
    checkUsername(username: string): Promise<CheckUsernameResponse>;
    setUsername(userId: string, username: string): Promise<SetUsernameResponse>;
    submitPhoneNumber(phoneNumber: PhoneNumber): Promise<SubmitPhoneNumberResponse>;
    resendRegistrationCode(): Promise<ResendCodeResponse>;
    confirmPhoneNumber(code: string): Promise<ConfirmPhoneNumberResponse>;
    getUsers(users: UsersArgs, allowStale: boolean): Promise<UsersResponse>;
    searchUsers(searchTerm: string, maxResults?: number): Promise<UserSummary[]>;
    upgradeStorage(newLimitBytes: number): Promise<UpgradeStorageResponse>;
    suspendUser(userId: string, reason: string): Promise<SuspendUserResponse>;
    unsuspendUser(userId: string): Promise<UnsuspendUserResponse>;
    markSuspectedBot(): Promise<MarkSuspectedBotResponse>;
    payForDiamondMembership(
        userId: string,
        token: Cryptocurrency,
        duration: DiamondMembershipDuration,
        recurring: boolean,
        expectedPriceE8s: bigint
    ): Promise<PayForDiamondMembershipResponse>;
}
