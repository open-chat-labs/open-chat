import type { IUserIndexClient } from "./userIndex.client.interface";
import { ChatSchema, getCachedUsers, setCachedUsers } from "../../utils/caching";
import type { IDBPDatabase } from "idb";
import type {
    ConfirmPhoneNumberResponse,
    CreateCanisterResponse,
    CurrentUserResponse,
    PartialUserSummary,
    PhoneNumber,
    RegistrationFeeResponse,
    ResendCodeResponse,
    SetUsernameResponse,
    SubmitPhoneNumberResponse,
    UpgradeCanisterResponse,
    UsersArgs,
    UsersResponse,
    UserSummary,
} from "../../domain/user/user";
import { groupBy } from "../../utils/list";

/**
 * This exists to decorate the user index client so that we can provide a write through cache to
 * indexDB for holding users
 */
export class CachingUserIndexClient implements IUserIndexClient {
    constructor(private db: Promise<IDBPDatabase<ChatSchema>>, private client: IUserIndexClient) {}

    async getUsers(users: UsersArgs): Promise<UsersResponse> {
        const unknownUsers = users.userGroups
            .filter((g) => g.updatedSince === BigInt(0))
            .flatMap((g) => g.users);

        const fromCache =
            unknownUsers.length > 0 ? await getCachedUsers(this.db, unknownUsers) : [];

        const args = this.buildGetUsersArgs(users, fromCache);

        const response = await this.client.getUsers(args);

        const mergedResponse = this.mergeGetUsersResponse(args, response, fromCache);

        await setCachedUsers(this.db, mergedResponse);

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

    generateRegistrationFee(): Promise<RegistrationFeeResponse> {
        return this.client.generateRegistrationFee();
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

    private buildGetUsersArgs(original: UsersArgs, fromCache: UserSummary[]): UsersArgs {
        if (fromCache.length === 0) {
            return original;
        }

        const fromCacheGrouped = groupBy(fromCache, (u) => u.updated);
        const fromCacheSet = new Set<string>(fromCache.map((u) => u.userId));

        const args: UsersArgs = {
            userGroups: [],
        };

        for (const group of original.userGroups) {
            if (group.updatedSince === BigInt(0)) {
                // These are the users which we attempted to read from the cache, any found in the cache should be
                // removed from the 'updatedSince = 0' group and added to new groups according to their 'updated' dates.
                const unknownUsers = group.users.filter((u) => !fromCacheSet.has(u));
                if (unknownUsers.length > 0) {
                    args.userGroups.push({
                        users: unknownUsers,
                        updatedSince: BigInt(0),
                    });
                }
            } else if (fromCacheGrouped.has(group.updatedSince)) {
                // If any users from the cache have matching 'updated' dates, append them to this existing group.
                args.userGroups.push({
                    users: [
                        ...group.users,
                        ...fromCacheGrouped.get(group.updatedSince)!.map((u) => u.userId),
                    ],
                    updatedSince: group.updatedSince,
                });
                // After adding the group of users from the cache we delete it so that after we have iterated over the
                // original groups we can detect which users from the cache have not yet been added.
                fromCacheGrouped.delete(group.updatedSince);
            } else {
                args.userGroups.push(group);
            }
        }

        // Now iterate over the users from the cache who have not yet been added to the args.
        for (const [updatedSince, users] of fromCacheGrouped) {
            args.userGroups.push({
                users: users.map((u) => u.userId),
                updatedSince: updatedSince,
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
                        userId,
                        username: userResponse.username ?? cached?.username,
                        lastOnline: userResponse.lastOnline,
                        updated: userResponse.updated,
                        blobReference: userResponse.blobReference,
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
}
