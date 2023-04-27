import type {
    CheckUsernameResponse,
    CurrentUserResponse,
    SetUsernameResponse,
    UsersArgs,
    UsersResponse,
    UserSummary,
    RegisterUserResponse,
    SuspendUserResponse,
    UnsuspendUserResponse,
    MarkSuspectedBotResponse,
    Cryptocurrency,
    DiamondMembershipDuration,
    PayForDiamondMembershipResponse,
    SetUserUpgradeConcurrencyResponse,
} from "openchat-shared";

export interface IUserIndexClient {
    getCurrentUser: () => Promise<CurrentUserResponse>;
    registerUser(username: string, referralCode: string | undefined): Promise<RegisterUserResponse>;
    checkUsername(username: string): Promise<CheckUsernameResponse>;
    setUsername(userId: string, username: string): Promise<SetUsernameResponse>;
    getUsers(users: UsersArgs, allowStale: boolean): Promise<UsersResponse>;
    searchUsers(searchTerm: string, maxResults?: number): Promise<UserSummary[]>;
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
    setUserUpgradeConcurrency(value: number): Promise<SetUserUpgradeConcurrencyResponse>;
    getPlatformModeratorGroup(): Promise<string>;
}
