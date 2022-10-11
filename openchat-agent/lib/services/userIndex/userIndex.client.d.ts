import type { Identity } from "@dfinity/agent";
import type { CheckUsernameResponse, ConfirmPhoneNumberResponse, CurrentUserResponse, SubmitPhoneNumberResponse, SetUsernameResponse, PhoneNumber, ResendCodeResponse, UsersArgs, UsersResponse, UserSummary, RegisterUserResponse, UpgradeStorageResponse, ChallengeAttempt, CreateChallengeResponse } from "../../domain/user/user";
import { CandidService } from "../candidService";
import type { IUserIndexClient } from "./userIndex.client.interface";
export declare class UserIndexClient extends CandidService implements IUserIndexClient {
    private userService;
    private constructor();
    static create(identity: Identity): IUserIndexClient;
    getCurrentUser(): Promise<CurrentUserResponse>;
    createChallenge(): Promise<CreateChallengeResponse>;
    registerUser(username: string, challengeAttempt: ChallengeAttempt, referredBy: string | undefined): Promise<RegisterUserResponse>;
    searchUsers(searchTerm: string, maxResults?: number): Promise<UserSummary[]>;
    getUsers(users: UsersArgs, _allowStale: boolean): Promise<UsersResponse>;
    upgradeStorage(newLimitBytes: number): Promise<UpgradeStorageResponse>;
    resendRegistrationCode(): Promise<ResendCodeResponse>;
    checkUsername(username: string): Promise<CheckUsernameResponse>;
    setUsername(_userId: string, username: string): Promise<SetUsernameResponse>;
    submitPhoneNumber(phoneNumber: PhoneNumber): Promise<SubmitPhoneNumberResponse>;
    confirmPhoneNumber(code: string): Promise<ConfirmPhoneNumberResponse>;
}
