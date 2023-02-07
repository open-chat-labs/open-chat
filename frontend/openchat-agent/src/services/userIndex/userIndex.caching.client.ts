import type { IUserIndexClient } from "./userIndex.client.interface";
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
    Logger,
    SuspendUserResponse,
    UnsuspendUserResponse,
    MarkSuspectedBotResponse,
    Cryptocurrency,
    DiamondMembershipDuration,
    PayForDiamondMembershipResponse,
} from "openchat-shared";
import { groupBy } from "../../utils/list";
import { profile } from "../common/profiling";
import { getCachedUsers, setCachedUsers, setUsername } from "../../utils/userCache";

function isUserSummary(user: PartialUserSummary): user is UserSummary {
    return user.username !== undefined;
}

/**
 * This exists to decorate the user index client so that we can provide a write through cache to
 * indexDB for holding users
 */
export class CachingUserIndexClient implements IUserIndexClient {
    constructor(private client: IUserIndexClient, private logger: Logger) {}

    @profile("userIndexCachingClient")
    async getUsers(users: UsersArgs, allowStale: boolean): Promise<UsersResponse> {
        const allUsers = users.userGroups.flatMap((g) => g.users);

        const fromCache = await getCachedUsers(allUsers);

        // We throw away all of the updatedSince values passed in and instead use the values from the cache, this
        // ensures the cache is always correct and doesn't miss any updates
        const args = this.buildGetUsersArgs(allUsers, fromCache, allowStale);

        const response = await this.client.getUsers(args, allowStale);

        const requestedFromServer = new Set<string>([...args.userGroups.flatMap((g) => g.users)]);

        // We return the fully hydrated users so that it is not possible for the Svelte store to miss any updates
        const mergedResponse = this.mergeGetUsersResponse(
            allUsers,
            requestedFromServer,
            response,
            fromCache
        );

        setCachedUsers(mergedResponse.users.filter(isUserSummary)).catch((err) =>
            this.logger.error("Failed to save users to the cache", err)
        );

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
        challengeAttempt: ChallengeAttempt,
        referredBy: string | undefined
    ): Promise<RegisterUserResponse> {
        return this.client.registerUser(username, challengeAttempt, referredBy);
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

    setUsername(userId: string, username: string): Promise<SetUsernameResponse> {
        return this.client.setUsername(userId, username).then((res) => {
            if (res === "success") {
                setUsername(userId, username);
            }
            return res;
        });
    }

    submitPhoneNumber(phoneNumber: PhoneNumber): Promise<SubmitPhoneNumberResponse> {
        return this.client.submitPhoneNumber(phoneNumber);
    }

    private buildGetUsersArgs(
        users: string[],
        fromCache: UserSummary[],
        allowStale: boolean
    ): UsersArgs {
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
        requestedFromServer: Set<string>,
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
                if (requestedFromServer.has(userId)) {
                    // If this user was requested from the server but wasn't included in the response, then that means
                    // our cached copy is up to date.
                    users.push({
                        ...cached,
                        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                        updated: response.serverTimestamp!,
                    });
                } else {
                    users.push(cached);
                }
            }
        }

        return {
            serverTimestamp: response.serverTimestamp,
            users,
        };
    }

    upgradeStorage(newLimitBytes: number): Promise<UpgradeStorageResponse> {
        return this.client.upgradeStorage(newLimitBytes);
    }

    suspendUser(userId: string, reason: string): Promise<SuspendUserResponse> {
        return this.client.suspendUser(userId, reason);
    }

    unsuspendUser(userId: string): Promise<UnsuspendUserResponse> {
        return this.client.unsuspendUser(userId);
    }

    markSuspectedBot(): Promise<MarkSuspectedBotResponse> {
        return this.client.markSuspectedBot();
    }

    payForDiamondMembership(
        token: Cryptocurrency,
        duration: DiamondMembershipDuration,
        recurring: boolean,
        expectedPriceE8s: bigint
    ): Promise<PayForDiamondMembershipResponse> {
        return this.client.payForDiamondMembership(token, duration, recurring, expectedPriceE8s);
    }
}
