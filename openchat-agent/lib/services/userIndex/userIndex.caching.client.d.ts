import type { IUserIndexClient } from "./userIndex.client.interface";
import type { ChallengeAttempt, CheckUsernameResponse, ConfirmPhoneNumberResponse, CreateChallengeResponse, CurrentUserResponse, PhoneNumber, RegisterUserResponse, ResendCodeResponse, SetUsernameResponse, SubmitPhoneNumberResponse, UpgradeStorageResponse, UsersArgs, UsersResponse, UserSummary } from "../../domain/user/user";
/**
 * This exists to decorate the user index client so that we can provide a write through cache to
 * indexDB for holding users
 */
export declare class CachingUserIndexClient implements IUserIndexClient {
    private client;
    constructor(client: IUserIndexClient);
    getUsers(users: UsersArgs, allowStale: boolean): Promise<UsersResponse>;
    getCurrentUser(): Promise<CurrentUserResponse>;
    createChallenge(): Promise<CreateChallengeResponse>;
    registerUser(username: string, challengeAttempt: ChallengeAttempt, referredBy: string | undefined): Promise<RegisterUserResponse>;
    confirmPhoneNumber(code: string): Promise<ConfirmPhoneNumberResponse>;
    resendRegistrationCode(): Promise<ResendCodeResponse>;
    searchUsers(searchTerm: string, maxResults?: number): Promise<UserSummary[]>;
    checkUsername(username: string): Promise<CheckUsernameResponse>;
    setUsername(userId: string, username: string): Promise<SetUsernameResponse>;
    submitPhoneNumber(phoneNumber: PhoneNumber): Promise<SubmitPhoneNumberResponse>;
    private buildGetUsersArgs;
    private mergeGetUsersResponse;
    upgradeStorage(newLimitBytes: number): Promise<UpgradeStorageResponse>;
}
