import type {
    CheckUsernameResponse,
    CurrentUserResponse,
    SetUsernameResponse,
    UsersArgs,
    UsersResponse,
    UserSummary,
    SuspendUserResponse,
    UnsuspendUserResponse,
    MarkSuspectedBotResponse,
    Cryptocurrency,
    DiamondMembershipDuration,
    PayForDiamondMembershipResponse,
    SetUserUpgradeConcurrencyResponse,
    ReferralLeaderboardRange,
    ReferralLeaderboardResponse,
} from "openchat-shared";

export interface IUserIndexClient {
    getCurrentUser: () => Promise<CurrentUserResponse>;
    userRegistrationCanister(): Promise<string>;
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
    getReferralLeaderboard(req?: ReferralLeaderboardRange): Promise<ReferralLeaderboardResponse>;
    getPlatformModeratorGroup(): Promise<string>;
}
