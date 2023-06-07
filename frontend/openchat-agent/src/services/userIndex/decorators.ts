import type {
    PartialUserSummary,
    SetUsernameResponse,
    UsersArgs,
    UsersResponse,
    UserSummary,
    Cryptocurrency,
    DiamondMembershipDuration,
    PayForDiamondMembershipResponse,
} from "openchat-shared";
import { groupBy } from "../../utils/list";
import {
    getCachedUsers,
    setCachedUsers,
    setUserDiamondStatusToTrue,
    setUsername,
} from "../../utils/userCache";

export function setUsernameDecorator() {
    return (
        _target: unknown,
        _propertyKey: unknown,
        desc: PropertyDescriptor
    ): PropertyDescriptor => {
        const fn = desc.value;
        desc.value = async function (
            userId: string,
            username: string
        ): Promise<SetUsernameResponse> {
            const res = await fn.call(this, userId, username);
            if (res === "success") {
                setUsername(userId, username);
            }
            return res;
        };
        return desc;
    };
}

export function payForDiamondMembershipDecorator() {
    return (
        _target: unknown,
        _propertyKey: unknown,
        desc: PropertyDescriptor
    ): PropertyDescriptor => {
        const fn = desc.value;
        desc.value = async function (
            userId: string,
            token: Cryptocurrency,
            duration: DiamondMembershipDuration,
            recurring: boolean,
            expectedPriceE8s: bigint
        ): Promise<PayForDiamondMembershipResponse> {
            const res = await fn.call(this, userId, token, duration, recurring, expectedPriceE8s);
            if (res === "success") {
                setUserDiamondStatusToTrue(userId);
            }
            return res;
        };
        return desc;
    };
}

export function getUsersDecorator() {
    return (
        _target: unknown,
        _propertyKey: unknown,
        desc: PropertyDescriptor
    ): PropertyDescriptor => {
        const fn = desc.value;
        desc.value = async function (
            users: UsersArgs,
            allowStale: boolean
        ): Promise<UsersResponse> {
            const allUsers = users.userGroups.flatMap((g) => g.users);

            const fromCache = await getCachedUsers(allUsers);

            // We throw away all of the updatedSince values passed in and instead use the values from the cache, this
            // ensures the cache is always correct and doesn't miss any updates
            const args = buildGetUsersArgs(allUsers, fromCache, allowStale);

            const response = await fn.call(this, args, allowStale);

            const requestedFromServer = new Set<string>([
                ...args.userGroups.flatMap((g) => g.users),
            ]);

            // We return the fully hydrated users so that it is not possible for the Svelte store to miss any updates
            const mergedResponse = mergeGetUsersResponse(
                allUsers,
                requestedFromServer,
                response,
                fromCache
            );

            setCachedUsers(mergedResponse.users.filter(isUserSummary)).catch((err) =>
                console.error("Failed to save users to the cache", err)
            );

            return mergedResponse;
        };
        return desc;
    };
}

function buildGetUsersArgs(
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
function mergeGetUsersResponse(
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

function isUserSummary(user: PartialUserSummary): user is UserSummary {
    return user.username !== undefined;
}
