var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { groupBy } from "../../utils/list";
import { isUserSummary } from "../../utils/user";
import { profile } from "../common/profiling";
import { rollbar } from "../../utils/logging";
import { getCachedUsers, setCachedUsers, setUsername } from "../../utils/userCache";
/**
 * This exists to decorate the user index client so that we can provide a write through cache to
 * indexDB for holding users
 */
export class CachingUserIndexClient {
    constructor(client) {
        this.client = client;
    }
    async getUsers(users, allowStale) {
        const allUsers = users.userGroups.flatMap((g) => g.users);
        const fromCache = await getCachedUsers(allUsers);
        // We throw away all of the updatedSince values passed in and instead use the values from the cache, this
        // ensures the cache is always correct and doesn't miss any updates
        const args = this.buildGetUsersArgs(allUsers, fromCache, allowStale);
        const response = await this.client.getUsers(args, allowStale);
        const requestedFromServer = new Set([...args.userGroups.flatMap((g) => g.users)]);
        // We return the fully hydrated users so that it is not possible for the Svelte store to miss any updates
        const mergedResponse = this.mergeGetUsersResponse(allUsers, requestedFromServer, response, fromCache);
        setCachedUsers(mergedResponse.users.filter(isUserSummary)).catch((err) => rollbar.error("Failed to save users to the cache", err));
        return mergedResponse;
    }
    getCurrentUser() {
        return this.client.getCurrentUser();
    }
    createChallenge() {
        return this.client.createChallenge();
    }
    registerUser(username, challengeAttempt, referredBy) {
        return this.client.registerUser(username, challengeAttempt, referredBy);
    }
    confirmPhoneNumber(code) {
        return this.client.confirmPhoneNumber(code);
    }
    resendRegistrationCode() {
        return this.client.resendRegistrationCode();
    }
    searchUsers(searchTerm, maxResults) {
        return this.client.searchUsers(searchTerm, maxResults);
    }
    checkUsername(username) {
        return this.client.checkUsername(username);
    }
    setUsername(userId, username) {
        return this.client.setUsername(userId, username).then((res) => {
            if (res === "success") {
                setUsername(userId, username);
            }
            return res;
        });
    }
    submitPhoneNumber(phoneNumber) {
        return this.client.submitPhoneNumber(phoneNumber);
    }
    buildGetUsersArgs(users, fromCache, allowStale) {
        const fromCacheGrouped = groupBy(fromCache, (u) => u.updated);
        const fromCacheSet = new Set(fromCache.map((u) => u.userId));
        const args = {
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
    mergeGetUsersResponse(allUsers, requestedFromServer, response, fromCache) {
        var _a, _b;
        if (fromCache.length === 0) {
            return response;
        }
        const fromCacheMap = new Map(fromCache.map((u) => [u.userId, u]));
        const responseMap = new Map(response.users.map((u) => [u.userId, u]));
        const users = [];
        for (const userId of allUsers) {
            const cached = fromCacheMap.get(userId);
            const userResponse = responseMap.get(userId);
            if (userResponse !== undefined) {
                users.push(Object.assign(Object.assign({}, userResponse), { username: (_a = userResponse.username) !== null && _a !== void 0 ? _a : cached === null || cached === void 0 ? void 0 : cached.username, blobReference: (_b = userResponse.blobReference) !== null && _b !== void 0 ? _b : cached === null || cached === void 0 ? void 0 : cached.blobReference }));
            }
            else if (cached !== undefined) {
                if (requestedFromServer.has(userId)) {
                    // If this user was requested from the server but wasn't included in the response, then that means
                    // our cached copy is up to date.
                    users.push(Object.assign(Object.assign({}, cached), { 
                        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                        updated: response.serverTimestamp }));
                }
                else {
                    users.push(cached);
                }
            }
        }
        return {
            serverTimestamp: response.serverTimestamp,
            users,
        };
    }
    upgradeStorage(newLimitBytes) {
        return this.client.upgradeStorage(newLimitBytes);
    }
}
__decorate([
    profile("userIndexCachingClient")
], CachingUserIndexClient.prototype, "getUsers", null);
//# sourceMappingURL=userIndex.caching.client.js.map