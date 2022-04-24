import type { IUserIndexClient } from "./userIndex.client.interface";
import { ChatSchema, getCachedUsers, setCachedUsers } from "../../utils/caching";
import type { IDBPDatabase } from "idb";
import type {
    ChallengeAttempt,
    CheckUsernameResponse,
    ConfirmPhoneNumberResponse,
    CreateChallengeResponse,
    CurrentUserResponse,
    PartialUserSummary,
    PhoneNumber,
    RegisterUserResponse,
    ResendCodeResponse,
    SetUsernameResponse,
    SubmitPhoneNumberResponse,
    UpgradeStorageResponse,
    UsersArgs,
    UsersResponse,
    UserSummary,
} from "../../domain/user/user";
import { groupBy } from "../../utils/list";
import { isUserSummary } from "../../utils/user";
import { profile } from "../common/profiling";

/**
 * This exists to decorate the user index client so that we can provide a write through cache to
 * indexDB for holding users
 */
export class CachingUserIndexClient implements IUserIndexClient {
    constructor(private db: Promise<IDBPDatabase<ChatSchema>>, private client: IUserIndexClient) {}

    @profile("userIndexCachingClient")
    async getUsers(users: UsersArgs, allowStale: boolean): Promise<UsersResponse> {
        const allUsers = users.userGroups.flatMap((g) => g.users);

        const fromCache = await getCachedUsers(this.db, allUsers);

        // We throw away all of the updatedSince values passed in and instead use the values from the cache, this
        // ensures the cache is always correct and doesn't miss any updates
        const args = this.buildGetUsersArgs(allUsers, fromCache, allowStale);

        const response = await this.client.getUsers(args, allowStale);

        // We return the fully hydrated users so that it is not possible for the Svelte store to miss any updates
        const mergedResponse = this.mergeGetUsersResponse(allUsers, response, fromCache);

        await setCachedUsers(this.db, mergedResponse.users.filter(isUserSummary));

        return mergedResponse;
    }

    getCurrentUser(): Promise<CurrentUserResponse> {
        return this.client.getCurrentUser();
    }

    createChallenge(): Promise<CreateChallengeResponse> {
        return this.client.createChallenge();
    }

    registerUser(
        username: string,
        challengeAttempt: ChallengeAttempt
    ): Promise<RegisterUserResponse> {
        return this.client.registerUser(username, challengeAttempt);
    }

    confirmPhoneNumber(code: string): Promise<ConfirmPhoneNumberResponse> {
        return this.client.confirmPhoneNumber(code);
    }

    resendRegistrationCode(): Promise<ResendCodeResponse> {
        return this.client.resendRegistrationCode();
    }

    searchUsers(searchTerm: string, maxResults?: number): Promise<UserSummary[]> {
        return this.client.searchUsers(searchTerm, maxResults);
    }

    checkUsername(username: string): Promise<CheckUsernameResponse> {
        return this.client.checkUsername(username);
    }

    setUsername(username: string): Promise<SetUsernameResponse> {
        return this.client.setUsername(username);
    }

    submitPhoneNumber(phoneNumber: PhoneNumber): Promise<SubmitPhoneNumberResponse> {
        return this.client.submitPhoneNumber(phoneNumber);
    }

    private buildGetUsersArgs(users: string[], fromCache: UserSummary[], allowStale: boolean): UsersArgs {
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

        if (!allowStale) {
            // Add the users found in the cache but only ask for updates since the date they were last updated in the cache
            for (const [updatedSince, users] of fromCacheGrouped) {
                args.userGroups.push({
                    users: users.map((u) => u.userId),
                    updatedSince,
                });
            }
        }

        return args;
    }

    // Merges the cached values into the response
    private mergeGetUsersResponse(
        allUsers: string[],
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
        const fromCacheSet = new Set<string>();

        const users: PartialUserSummary[] = [];

        for (const userId of allUsers) {
            const cached = fromCacheMap.get(userId);
            const userResponse = responseMap.get(userId);

            if (userResponse !== undefined) {
                users.push({
                    ...userResponse,
                    username: userResponse.username ?? cached?.username,
                    blobReference: userResponse.blobReference ?? cached?.blobReference,
                });
            } else if (cached !== undefined) {
                users.push(cached);
                fromCacheSet.add(userId);
            }
        }

        return {
            serverTimestamp: response.serverTimestamp,
            users,
            fromCache: fromCacheSet
        };
    }

    upgradeStorage(newLimitBytes: number): Promise<UpgradeStorageResponse> {
        return this.client.upgradeStorage(newLimitBytes);
    }
}
