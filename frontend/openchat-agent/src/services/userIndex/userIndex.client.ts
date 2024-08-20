import { groupBy } from "../../utils/list";
import type { HttpAgent, Identity } from "@dfinity/agent";
import type {
    CheckUsernameResponse,
    CurrentUserResponse,
    SetUsernameResponse,
    UsersArgs,
    UsersResponse,
    UserSummary,
    SuspendUserResponse,
    UnsuspendUserResponse,
    DiamondMembershipDuration,
    PayForDiamondMembershipResponse,
    SetUserUpgradeConcurrencyResponse,
    SetDisplayNameResponse,
    DiamondMembershipFees,
    ChitUserBalance,
    UsersApiResponse,
    UserSummaryUpdate,
    ChitState,
    SubmitProofOfUniquePersonhoodResponse,
} from "openchat-shared";
import {
    mergeUserSummaryWithUpdates,
    offline,
    Stream,
    userSummaryFromCurrentUserSummary,
} from "openchat-shared";
import { CandidService } from "../candidService";
import {
    checkUsernameResponse,
    setUsernameResponse,
    usersApiResponse,
    suspendUserResponse,
    unsuspendUserResponse,
    payForDiamondMembershipResponse,
    setDisplayNameResponse,
    diamondMembershipFeesResponse,
    chitLeaderboardResponse,
    submitProofOfUniquePersonhoodResponse,
    currentUserResponse,
    userRegistrationCanisterResponse,
    userSearchResponse,
    apiJsonDiamondDuration,
} from "./mappers";
import { apiJsonToken } from "../common/chatMappers";
import {
    getCachedUsers,
    getCachedDeletedUserIds,
    getSuspendedUsersSyncedUpTo,
    // setCachedDeletedUserIds,
    setCachedUsers,
    setDisplayNameInCache,
    setSuspendedUsersSyncedUpTo,
    setUserDiamondStatusInCache,
    setUsernameInCache,
} from "../../utils/userCache";
import {
    getCachedCurrentUser,
    mergeCachedCurrentUser,
    setCachedCurrentUser,
    setCurrentUserDiamondStatusInCache,
} from "../../utils/caching";
import { bytesToHexString, hexStringToBytes, mapOptional } from "../../utils/mapping";
import {
    Empty,
    userIndexCheckUsernameArgs,
    userIndexCheckUsernameResponse,
    userIndexChitLeaderboardResponse,
    userIndexCurrentUserResponse,
    userIndexDiamondMembershipFeesResponse,
    userIndexPayForDiamondMembershipArgs,
    userIndexPayForDiamondMembershipResponse,
    userIndexPlatformModeratorsGroupResponse,
    userIndexReportedMessagesArgs,
    userIndexReportedMessagesResponse,
    userIndexSearchArgs,
    userIndexSearchResponse,
    userIndexSetDiamondMembershipFeesArgs,
    userIndexSetDiamondMembershipFeesResponse,
    userIndexSetDisplayNameArgs,
    userIndexSetDisplayNameResponse,
    userIndexSetModerationFlagsArgs,
    userIndexSetModerationFlagsResponse,
    userIndexSetUsernameArgs,
    userIndexSetUsernameResponse,
    userIndexSetUserUpgradeConcurrencyArgs,
    userIndexSetUserUpgradeConcurrencyResponse,
    userIndexSubmitProofOfUniquePersonhoodArgs,
    userIndexSubmitProofOfUniquePersonhoodResponse,
    userIndexSuspendUserArgs,
    userIndexSuspendUserResponse,
    userIndexUnsuspendUserArgs,
    userIndexUnsuspendUserResponse,
    userIndexUserRegistrationCanisterResponse,
    userIndexUsersArgs,
    userIndexUsersResponse,
} from "../../typebox";

export class UserIndexClient extends CandidService {
    constructor(identity: Identity, agent: HttpAgent, canisterId: string) {
        super(identity, agent, canisterId);
    }

    getCurrentUser(): Stream<CurrentUserResponse> {
        return new Stream(async (resolve, reject) => {
            try {
                const principal = this.identity.getPrincipal().toString();
                const cachedUser = await getCachedCurrentUser(principal);

                const isOffline = offline();

                if (cachedUser !== undefined) {
                    resolve(cachedUser, isOffline);
                }

                if (!isOffline) {
                    const liveUser = await this.executeMsgpackQuery(
                        "current_user",
                        {},
                        currentUserResponse,
                        Empty,
                        userIndexCurrentUserResponse
                    );
                    if (liveUser.kind === "created_user") {
                        setCachedCurrentUser(principal, liveUser);
                    }
                    resolve(liveUser, true);
                }
            } catch (err) {
                reject(err);
            }
        });
    }

    setModerationFlags(flags: number): Promise<boolean> {
        return this.executeMsgpackUpdate(
            "set_moderation_flags",
            {
                moderation_flags_enabled: flags,
            },
            (_) => true,
            userIndexSetModerationFlagsArgs,
            userIndexSetModerationFlagsResponse
        );
    }

    userRegistrationCanister(): Promise<string> {
        return this.executeMsgpackQuery(
            "user_registration_canister",
            {},
            userRegistrationCanisterResponse,
            Empty,
            userIndexUserRegistrationCanisterResponse
        );
    }

    searchUsers(searchTerm: string, maxResults = 20): Promise<UserSummary[]> {
        const args = {
            search_term: searchTerm,
            max_results: maxResults,
        };
        return this.executeMsgpackQuery(
            "search",
            args,
            userSearchResponse,
            userIndexSearchArgs,
            userIndexSearchResponse
        );
    }

    async getUsers(
        chitState: ChitState,
        users: UsersArgs,
        allowStale: boolean
    ): Promise<UsersResponse> {
        const allUsers = users.userGroups.flatMap((g) => g.users);

        const fromCache = await getCachedUsers(allUsers);
        const cachedDeletedUserIds = await getCachedDeletedUserIds();
        const suspendedUsersSyncedTo = await getSuspendedUsersSyncedUpTo();

        // We throw away all of the updatedSince values passed in and instead use the values from the cache, this
        // ensures the cache is always correct and doesn't miss any updates
        const args = this.buildGetUsersArgs(allUsers, fromCache, allowStale, cachedDeletedUserIds);

        const requestedFromServer = new Set<string>([...args.userGroups.flatMap((g) => g.users)]);

        const apiResponse = await this.getUsersFromBackend(args, suspendedUsersSyncedTo);

        // We return the fully hydrated users so that it is not possible for the Svelte store to miss any updates
        const mergedResponse = this.mergeGetUsersResponse(
            chitState,
            allUsers,
            requestedFromServer,
            apiResponse,
            fromCache
        );

        // setCachedDeletedUserIds(apiResponse.deletedUserIds);

        setCachedUsers(mergedResponse.users).catch((err) =>
            console.error("Failed to save users to the cache", err)
        );

        if (mergedResponse.currentUser) {
            mergeCachedCurrentUser(this.principal.toString(), mergedResponse.currentUser);
        }

        if (mergedResponse.serverTimestamp !== undefined) {
            setSuspendedUsersSyncedUpTo(mergedResponse.serverTimestamp).catch((err) =>
                console.error("Failed to set 'suspended users synced up to' in the cache", err)
            );
        }

        return mergedResponse;
    }

    private getUsersFromBackend(
        users: UsersArgs,
        suspendedUsersSyncedUpTo: bigint | undefined
    ): Promise<UsersApiResponse> {
        if (offline())
            return Promise.resolve({
                serverTimestamp: 0n,
                users: [],
                deletedUserIds: new Set(),
            });

        const userGroups = users.userGroups.filter((g) => g.users.length > 0);

        const args = {
            user_groups: userGroups.map(({ users, updatedSince }) => ({
                users: users.map(hexStringToBytes),
                updated_since: updatedSince,
            })),
            users_suspended_since: suspendedUsersSyncedUpTo,
        };

        return this.executeMsgpackQuery(
            "users",
            args,
            usersApiResponse,
            userIndexUsersArgs,
            userIndexUsersResponse
        );
    }

    private buildGetUsersArgs(
        users: string[],
        fromCache: UserSummary[],
        allowStale: boolean,
        _cachedDeletedUserIds: Set<string>
    ): UsersArgs {
        const fromCacheGrouped = groupBy(fromCache, (u) => u.updated);
        const fromCacheSet = new Set<string>(fromCache.map((u) => u.userId));

        const args: UsersArgs = {
            userGroups: [],
        };

        // Add the users not found in the cache and ask for all updates
        const notFoundInCache = users.filter(
            // (u) => !fromCacheSet.has(u) && !cachedDeletedUserIds.has(u),
            (u) => !fromCacheSet.has(u)
        );
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
                    users: users
                        // .filter((u) => !cachedDeletedUserIds.has(u.userId))
                        .map((u) => u.userId),
                    updatedSince,
                });
            }
        }

        return args;
    }

    // Merges the cached values into the response
    private mergeGetUsersResponse(
        chitState: ChitState,
        allUsersRequested: string[],
        requestedFromServer: Set<string>,
        apiResponse: UsersApiResponse,
        fromCache: UserSummary[]
    ): UsersResponse {
        const fromCacheMap = new Map<string, UserSummary>(fromCache.map((u) => [u.userId, u]));
        const apiResponseMap = new Map<string, UserSummaryUpdate>(
            apiResponse.users.map((u) => [u.userId, u])
        );

        const users: UserSummary[] = [];

        for (const userId of allUsersRequested) {
            const cached = fromCacheMap.get(userId);
            const fromServer = apiResponseMap.get(userId);

            if (fromServer !== undefined) {
                apiResponseMap.delete(userId);
                const merged = mergeUserSummaryWithUpdates(
                    cached,
                    fromServer,
                    apiResponse.serverTimestamp
                );
                if (merged !== undefined) {
                    users.push(merged);
                }
            } else if (cached !== undefined) {
                if (cached.userId !== apiResponse.currentUser?.userId) {
                    if (requestedFromServer.has(userId)) {
                        // If this user was requested from the server but wasn't included in the response, then that means
                        // our cached copy is up to date.
                        users.push({
                            ...cached,
                            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                            updated: apiResponse.serverTimestamp!,
                        });
                    } else {
                        users.push(cached);
                    }
                }
            } else {
                // if we get here it means that for this user, nothing came back from the server
                // & nothing was in the cache - this would be odd but worth knowing if this is happening
                console.debug(
                    "USERS: userId requested not in cache and not returned from server",
                    userId
                );
            }
        }

        // This is needed because newly suspended users won't have been included in the `allUsers` array
        for (const user of apiResponseMap.values()) {
            const cached = fromCacheMap.get(user.userId);
            const merged = mergeUserSummaryWithUpdates(cached, user, apiResponse.serverTimestamp);
            if (merged !== undefined) {
                users.push(merged);
            }
        }

        // let's see if we got the current user back from the server
        if (apiResponse.currentUser !== undefined) {
            users.push(userSummaryFromCurrentUserSummary(chitState, apiResponse.currentUser));
        }

        return {
            serverTimestamp: apiResponse.serverTimestamp,
            users,
            currentUser: apiResponse.currentUser,
            deletedUserIds: apiResponse.deletedUserIds,
        };
    }

    checkUsername(username: string): Promise<CheckUsernameResponse> {
        const args = {
            username: username,
        };
        return this.executeMsgpackQuery(
            "check_username",
            args,
            checkUsernameResponse,
            userIndexCheckUsernameArgs,
            userIndexCheckUsernameResponse
        );
    }

    setUsername(userId: string, username: string): Promise<SetUsernameResponse> {
        return this.executeMsgpackUpdate(
            "set_username",
            { username },
            setUsernameResponse,
            userIndexSetUsernameArgs,
            userIndexSetUsernameResponse
        ).then((res) => {
            if (res === "success") {
                setUsernameInCache(userId, username);
            }
            return res;
        });
    }

    setDisplayName(
        userId: string,
        displayName: string | undefined
    ): Promise<SetDisplayNameResponse> {
        return this.executeMsgpackUpdate(
            "set_display_name",
            {
                display_name: displayName,
            },
            setDisplayNameResponse,
            userIndexSetDisplayNameArgs,
            userIndexSetDisplayNameResponse
        ).then((res) => {
            if (res === "success") {
                setDisplayNameInCache(userId, displayName);
            }
            return res;
        });
    }

    suspendUser(userId: string, reason: string): Promise<SuspendUserResponse> {
        return this.executeMsgpackUpdate(
            "suspend_user",
            {
                user_id: hexStringToBytes(userId),
                reason,
            },
            suspendUserResponse,
            userIndexSuspendUserArgs,
            userIndexSuspendUserResponse
        );
    }

    unsuspendUser(userId: string): Promise<UnsuspendUserResponse> {
        return this.executeMsgpackUpdate(
            "unsuspend_user",
            {
                user_id: hexStringToBytes(userId),
            },
            unsuspendUserResponse,
            userIndexUnsuspendUserArgs,
            userIndexUnsuspendUserResponse
        );
    }

    payForDiamondMembership(
        userId: string,
        token: string,
        duration: DiamondMembershipDuration,
        recurring: boolean,
        expectedPriceE8s: bigint
    ): Promise<PayForDiamondMembershipResponse> {
        return this.executeMsgpackUpdate(
            "pay_for_diamond_membership",
            {
                token: apiJsonToken(token),
                duration: apiJsonDiamondDuration(duration),
                recurring,
                expected_price_e8s: expectedPriceE8s,
            },
            (res) => payForDiamondMembershipResponse(duration, res),
            userIndexPayForDiamondMembershipArgs,
            userIndexPayForDiamondMembershipResponse
        ).then((res) => {
            if (res.kind === "success") {
                const principal = this.identity.getPrincipal().toString();
                setUserDiamondStatusInCache(userId, res.status);
                setCurrentUserDiamondStatusInCache(principal, res.status);
            }
            return res;
        });
    }

    setUserUpgradeConcurrency(value: number): Promise<SetUserUpgradeConcurrencyResponse> {
        return this.executeMsgpackUpdate(
            "set_user_upgrade_concurrency",
            { value },
            () => "success",
            userIndexSetUserUpgradeConcurrencyArgs,
            userIndexSetUserUpgradeConcurrencyResponse
        );
    }

    getPlatformModeratorGroup(): Promise<string> {
        return this.executeMsgpackQuery(
            "platform_moderators_group",
            {},
            (res) => bytesToHexString(res.Success),
            Empty,
            userIndexPlatformModeratorsGroupResponse
        );
    }

    diamondMembershipFees(): Promise<DiamondMembershipFees[]> {
        return this.executeMsgpackQuery(
            "diamond_membership_fees",
            {},
            diamondMembershipFeesResponse,
            Empty,
            userIndexDiamondMembershipFeesResponse
        );
    }

    setDiamondMembershipFees(fees: DiamondMembershipFees[]): Promise<boolean> {
        const chatFees = fees.find((f) => f.token === "CHAT");
        const icpFees = fees.find((f) => f.token === "ICP");

        if (chatFees === undefined || icpFees === undefined) {
            return Promise.resolve(false);
        }

        const args = {
            fees: {
                chat_fees: {
                    one_month: chatFees.oneMonth,
                    three_months: chatFees.threeMonths,
                    one_year: chatFees.oneYear,
                    lifetime: chatFees.lifetime,
                },
                icp_fees: {
                    one_month: icpFees.oneMonth,
                    three_months: icpFees.threeMonths,
                    one_year: icpFees.oneYear,
                    lifetime: icpFees.lifetime,
                },
            },
        };

        return this.executeMsgpackUpdate(
            "set_diamond_membership_fees",
            args,
            (res) => res === "Success",
            userIndexSetDiamondMembershipFeesArgs,
            userIndexSetDiamondMembershipFeesResponse
        );
    }

    reportedMessages(userId: string | undefined): Promise<string> {
        return this.executeMsgpackQuery(
            "reported_messages",
            {
                user_id: mapOptional(userId, hexStringToBytes),
            },
            (res) => res.Success.json,
            userIndexReportedMessagesArgs,
            userIndexReportedMessagesResponse
        );
    }

    chitLeaderboard(): Promise<ChitUserBalance[]> {
        return this.executeMsgpackQuery(
            "chit_leaderboard",
            {},
            chitLeaderboardResponse,
            Empty,
            userIndexChitLeaderboardResponse
        );
    }

    submitProofOfUniquePersonhood(
        iiPrincipal: string,
        credential: string
    ): Promise<SubmitProofOfUniquePersonhoodResponse> {
        const args = {
            user_ii_principal: hexStringToBytes(iiPrincipal),
            credential_jwt: credential,
        };
        return this.executeMsgpackUpdate(
            "submit_proof_of_unique_personhood",
            args,
            submitProofOfUniquePersonhoodResponse,
            userIndexSubmitProofOfUniquePersonhoodArgs,
            userIndexSubmitProofOfUniquePersonhoodResponse
        );
    }
}
