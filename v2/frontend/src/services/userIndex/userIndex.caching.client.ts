import type { IUserIndexClient } from "./userIndex.client.interface";
import { ChatSchema, getCachedUsers, setCachedUsers } from "../../utils/caching";
import type { IDBPDatabase } from "idb";
import type {
    ConfirmPhoneNumberResponse,
    CreateCanisterResponse,
    CurrentUserResponse,
    FeeCurrency,
    NotificationFeePaidResponse,
    PartialUserSummary,
    PhoneNumber,
    RefreshAccountBalanceResponse,
    RegisterUserResponse,
    RegistrationFeeResponse,
    ResendCodeResponse,
    SetUsernameResponse,
    SubmitPhoneNumberResponse,
    UpgradeCanisterResponse,
    UpgradeStorageResponse,
    UsersArgs,
    UsersResponse,
    UserSummary,
} from "../../domain/user/user";
import { groupBy } from "../../utils/list";
import { isUserSummary } from "../../utils/user";

/**
 * This exists to decorate the user index client so that we can provide a write through cache to
 * indexDB for holding users
 */
export class CachingUserIndexClient implements IUserIndexClient {
    constructor(private db: Promise<IDBPDatabase<ChatSchema>>, private client: IUserIndexClient) {}

    async getUsers(users: UsersArgs): Promise<UsersResponse> {
        const allUsers = users.userGroups.flatMap((g) => g.users);

        const fromCache = await getCachedUsers(this.db, allUsers);

        // We throw away all of the updatedSince values passed in and instead use the values from the cache, this
        // ensures the cache is always correct and doesn't miss any updates
        const args = this.buildGetUsersArgs(allUsers, fromCache);

        const response = await this.client.getUsers(args);

        // We return the fully hydrated users so that it is not possible for the Svelte store to miss any updates
        const mergedResponse = this.mergeGetUsersResponse(args, response, fromCache);

        await setCachedUsers(this.db, mergedResponse.users.filter(isUserSummary));

        return mergedResponse;
    }

    createCanister(): Promise<CreateCanisterResponse> {
        return this.client.createCanister();
    }

    getCurrentUser(): Promise<CurrentUserResponse> {
        return this.client.getCurrentUser();
    }

    upgradeUser(): Promise<UpgradeCanisterResponse> {
        return this.client.upgradeUser();
    }

    confirmPhoneNumber(code: string): Promise<ConfirmPhoneNumberResponse> {
        return this.client.confirmPhoneNumber(code);
    }

    notifyRegistrationFeePaid(): Promise<NotificationFeePaidResponse> {
        return this.client.notifyRegistrationFeePaid();
    }

    generateRegistrationFee(currency: FeeCurrency): Promise<RegistrationFeeResponse> {
        return this.client.generateRegistrationFee(currency);
    }

    resendRegistrationCode(): Promise<ResendCodeResponse> {
        return this.client.resendRegistrationCode();
    }

    searchUsers(searchTerm: string, maxResults?: number): Promise<UserSummary[]> {
        return this.client.searchUsers(searchTerm, maxResults);
    }

    setUsername(username: string): Promise<SetUsernameResponse> {
        return this.client.setUsername(username);
    }

    submitPhoneNumber(phoneNumber: PhoneNumber): Promise<SubmitPhoneNumberResponse> {
        return this.client.submitPhoneNumber(phoneNumber);
    }

    private buildGetUsersArgs(users: string[], fromCache: UserSummary[]): UsersArgs {
        const fromCacheGrouped = groupBy(fromCache, (u) => u.updated);
        const fromCacheSet = new Set<string>(fromCache.map((u) => u.userId));

        const args: UsersArgs = {
            userGroups: [],
        };

        // Add the users not found in the cache and ask for all updates
        const notFoundInCache = users.filter((u) => !fromCacheSet.has(u));
        if (notFoundInCache.length > 0) {
            args.userGroups.push({
                users: notFoundInCache,
                updatedSince: BigInt(0),
            });
        }

        // Add the users found in the cache but only ask for updates since the date they were last updated in the cache
        for (const [updatedSince, users] of fromCacheGrouped) {
            args.userGroups.push({
                users: users.map((u) => u.userId),
                updatedSince,
            });
        }

        return args;
    }

    // Merges the cached values into the response
    private mergeGetUsersResponse(
        args: UsersArgs,
        response: UsersResponse,
        fromCache: UserSummary[]
    ): UsersResponse {
        if (fromCache.length === 0) {
            return response;
        }

        const fromCacheMap = new Map<string, UserSummary>(fromCache.map((u) => [u.userId, u]));
        const responseMap = new Map<string, PartialUserSummary>(
            response.users.map((u) => [u.userId, u])
        );

        const users: PartialUserSummary[] = [];

        for (const group of args.userGroups) {
            for (const userId of group.users) {
                const cached = fromCacheMap.get(userId);
                const userResponse = responseMap.get(userId);

                if (userResponse !== undefined) {
                    users.push({
                        ...userResponse,
                        username: userResponse.username ?? cached?.username,
                        blobReference: userResponse.blobReference ?? cached?.blobReference,
                    });
                } else if (cached !== undefined) {
                    users.push({
                        ...cached,
                        updated: response.timestamp,
                    });
                }
            }
        }

        return {
            users,
            timestamp: response.timestamp,
        };
    }

    registerUser(username: string): Promise<RegisterUserResponse> {
        return this.client.registerUser(username);
    }

    upgradeStorage(newLimitBytes: number): Promise<UpgradeStorageResponse> {
        return this.client.upgradeStorage(newLimitBytes);
    }

    refreshBalance(): Promise<RefreshAccountBalanceResponse> {
        return this.client.refreshBalance();
    }
}
