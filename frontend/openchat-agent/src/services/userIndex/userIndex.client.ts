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
    ReferralLeaderboardRange,
    ReferralLeaderboardResponse,
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
    referralLeaderboardResponse,
    setDisplayNameResponse,
    diamondMembershipFeesResponse,
    chitLeaderboardResponseJson,
    submitProofOfUniquePersonhoodResponse,
    currentUserResponseJson,
    userRegistrationCanisterResponseJson,
    userSearchResponseJson,
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
import { mapOptional } from "../../utils/mapping";
import {
    getCachedCurrentUser,
    mergeCachedCurrentUser,
    setCachedCurrentUser,
    setCurrentUserDiamondStatusInCache,
} from "../../utils/caching";
import {
    emptySchema,
    userIndexCheckUsernameArgsSchema,
    userIndexCheckUsernameResponseSchema,
    userIndexChitLeaderboardResponseSchema,
    userIndexCurrentUserResponseSchema,
    userIndexDiamondMembershipFeesResponseSchema,
    userIndexPayForDiamondMembershipArgsSchema,
    userIndexPayForDiamondMembershipResponseSchema,
    userIndexPlatformModeratorsGroupResponseSchema,
    userIndexReferralLeaderboardArgsSchema,
    userIndexReferralLeaderboardResponseSchema,
    userIndexReportedMessagesArgsSchema,
    userIndexReportedMessagesResponseSchema,
    userIndexSearchArgsSchema,
    userIndexSearchResponseSchema,
    userIndexSetDiamondMembershipFeesArgsSchema,
    userIndexSetDiamondMembershipFeesResponseSchema,
    userIndexSetDisplayNameArgsSchema,
    userIndexSetDisplayNameResponseSchema,
    userIndexSetModerationFlagsArgsSchema,
    userIndexSetUsernameArgsSchema,
    userIndexSetUsernameResponseSchema,
    userIndexSetUserUpgradeConcurrencyArgsSchema,
    userIndexSetUserUpgradeConcurrencyResponseSchema,
    userIndexSubmitProofOfUniquePersonhoodArgsSchema,
    userIndexSubmitProofOfUniquePersonhoodResponseSchema,
    userIndexSuspendUserArgsSchema,
    userIndexSuspendUserResponseSchema,
    userIndexUnsuspendUserArgsSchema,
    userIndexUnsuspendUserResponseSchema,
    userIndexUserRegistrationCanisterResponseSchema,
    userIndexUsersArgsSchema,
    userIndexUsersResponseSchema,
} from "../../zod";

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
                    const liveUser = await this.executeJsonQuery(
                        "current_user",
                        {},
                        currentUserResponseJson,
                        emptySchema,
                        userIndexCurrentUserResponseSchema,
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
        return this.executeJsonUpdate(
            "set_moderation_flags",
            {
                moderation_flags_enabled: flags,
            },
            (_) => true,
            userIndexSetModerationFlagsArgsSchema,
            userIndexSetModerationFlagsArgsSchema,
        );
    }

    userRegistrationCanister(): Promise<string> {
        return this.executeJsonQuery(
            "user_registration_canister",
            {},
            userRegistrationCanisterResponseJson,
            emptySchema,
            userIndexUserRegistrationCanisterResponseSchema,
        );
    }

    searchUsers(searchTerm: string, maxResults = 20): Promise<UserSummary[]> {
        const args = {
            search_term: searchTerm,
            max_results: maxResults,
        };
        return this.executeJsonQuery(
            "search",
            args,
            userSearchResponseJson,
            userIndexSearchArgsSchema,
            userIndexSearchResponseSchema,
        );
    }

    async getUsers(
        chitState: ChitState,
        users: UsersArgs,
        allowStale: boolean,
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
            fromCache,
        );

        // setCachedDeletedUserIds(apiResponse.deletedUserIds);

        setCachedUsers(mergedResponse.users).catch((err) =>
            console.error("Failed to save users to the cache", err),
        );

        if (mergedResponse.currentUser) {
            mergeCachedCurrentUser(this.principal.toString(), mergedResponse.currentUser);
        }

        if (mergedResponse.serverTimestamp !== undefined) {
            setSuspendedUsersSyncedUpTo(mergedResponse.serverTimestamp).catch((err) =>
                console.error("Failed to set 'suspended users synced up to' in the cache", err),
            );
        }

        return mergedResponse;
    }

    private getUsersFromBackend(
        users: UsersArgs,
        suspendedUsersSyncedUpTo: bigint | undefined,
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
                users,
                updated_since: updatedSince,
            })),
            users_suspended_since: suspendedUsersSyncedUpTo,
        };

        return this.executeJsonQuery(
            "users",
            args,
            usersApiResponse,
            userIndexUsersArgsSchema,
            userIndexUsersResponseSchema,
        );
    }

    private buildGetUsersArgs(
        users: string[],
        fromCache: UserSummary[],
        allowStale: boolean,
        _cachedDeletedUserIds: Set<string>,
    ): UsersArgs {
        const fromCacheGrouped = groupBy(fromCache, (u) => u.updated);
        const fromCacheSet = new Set<string>(fromCache.map((u) => u.userId));

        const args: UsersArgs = {
            userGroups: [],
        };

        // Add the users not found in the cache and ask for all updates
        const notFoundInCache = users.filter(
            // (u) => !fromCacheSet.has(u) && !cachedDeletedUserIds.has(u),
            (u) => !fromCacheSet.has(u),
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
        fromCache: UserSummary[],
    ): UsersResponse {
        const fromCacheMap = new Map<string, UserSummary>(fromCache.map((u) => [u.userId, u]));
        const apiResponseMap = new Map<string, UserSummaryUpdate>(
            apiResponse.users.map((u) => [u.userId, u]),
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
                    apiResponse.serverTimestamp,
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
                    userId,
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
        return this.executeJsonQuery(
            "check_username",
            args,
            checkUsernameResponse,
            userIndexCheckUsernameArgsSchema,
            userIndexCheckUsernameResponseSchema,
        );
    }

    setUsername(userId: string, username: string): Promise<SetUsernameResponse> {
        return this.executeJsonUpdate(
            "set_username",
            { username },
            setUsernameResponse,
            userIndexSetUsernameArgsSchema,
            userIndexSetUsernameResponseSchema,
        ).then((res) => {
            if (res === "success") {
                setUsernameInCache(userId, username);
            }
            return res;
        });
    }

    setDisplayName(
        userId: string,
        displayName: string | undefined,
    ): Promise<SetDisplayNameResponse> {
        return this.executeJsonUpdate(
            "set_display_name",
            {
                display_name: displayName,
            },
            setDisplayNameResponse,
            userIndexSetDisplayNameArgsSchema,
            userIndexSetDisplayNameResponseSchema,
        ).then((res) => {
            if (res === "success") {
                setDisplayNameInCache(userId, displayName);
            }
            return res;
        });
    }

    suspendUser(userId: string, reason: string): Promise<SuspendUserResponse> {
        return this.executeJsonUpdate(
            "suspend_user",
            {
                user_id: userId,
                reason,
            },
            suspendUserResponse,
            userIndexSuspendUserArgsSchema,
            userIndexSuspendUserResponseSchema,
        );
    }

    unsuspendUser(userId: string): Promise<UnsuspendUserResponse> {
        return this.executeJsonUpdate(
            "unsuspend_user",
            {
                user_id: userId,
            },
            unsuspendUserResponse,
            userIndexUnsuspendUserArgsSchema,
            userIndexUnsuspendUserResponseSchema,
        );
    }

    payForDiamondMembership(
        userId: string,
        token: string,
        duration: DiamondMembershipDuration,
        recurring: boolean,
        expectedPriceE8s: bigint,
    ): Promise<PayForDiamondMembershipResponse> {
        return this.executeJsonUpdate(
            "pay_for_diamond_membership",
            {
                token: apiJsonToken(token),
                duration: apiJsonDiamondDuration(duration),
                recurring,
                expected_price_e8s: expectedPriceE8s,
            },
            (res) => payForDiamondMembershipResponse(duration, res),
            userIndexPayForDiamondMembershipArgsSchema,
            userIndexPayForDiamondMembershipResponseSchema,
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
        return this.executeJsonUpdate(
            "set_user_upgrade_concurrency",
            { value },
            () => "success",
            userIndexSetUserUpgradeConcurrencyArgsSchema,
            userIndexSetUserUpgradeConcurrencyResponseSchema,
        );
    }

    getReferralLeaderboard(req?: ReferralLeaderboardRange): Promise<ReferralLeaderboardResponse> {
        return this.executeJsonQuery(
            "referral_leaderboard",
            {
                count: 10,
                filter: mapOptional(req, (r) => {
                    return {
                        Month: {
                            year: r.year,
                            month: r.month,
                        },
                    };
                }),
            },
            referralLeaderboardResponse,
            userIndexReferralLeaderboardArgsSchema,
            userIndexReferralLeaderboardResponseSchema,
        );
    }

    getPlatformModeratorGroup(): Promise<string> {
        return this.executeJsonQuery(
            "platform_moderators_group",
            {},
            (res) => res.Success,
            emptySchema,
            userIndexPlatformModeratorsGroupResponseSchema,
        );
    }

    diamondMembershipFees(): Promise<DiamondMembershipFees[]> {
        return this.executeJsonQuery(
            "diamond_membership_fees",
            {},
            diamondMembershipFeesResponse,
            emptySchema,
            userIndexDiamondMembershipFeesResponseSchema,
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

        return this.executeJsonUpdate(
            "set_diamond_membership_fees",
            args,
            (res) => res === "Success",
            userIndexSetDiamondMembershipFeesArgsSchema,
            userIndexSetDiamondMembershipFeesResponseSchema,
        );
    }

    reportedMessages(userId: string | undefined): Promise<string> {
        return this.executeJsonQuery(
            "reported_messages",
            {
                user_id: userId,
            },
            (res) => res.Success.json,
            userIndexReportedMessagesArgsSchema,
            userIndexReportedMessagesResponseSchema,
        );
    }

    chitLeaderboard(): Promise<ChitUserBalance[]> {
        return this.executeJsonQuery(
            "chit_leaderboard",
            {},
            chitLeaderboardResponseJson,
            emptySchema,
            userIndexChitLeaderboardResponseSchema,
        );
    }

    submitProofOfUniquePersonhood(
        iiPrincipal: string,
        credential: string,
    ): Promise<SubmitProofOfUniquePersonhoodResponse> {
        const args = {
            user_ii_principal: iiPrincipal,
            credential_jwt: credential,
        };
        return this.executeJsonUpdate(
            "submit_proof_of_unique_personhood",
            args,
            submitProofOfUniquePersonhoodResponse,
            userIndexSubmitProofOfUniquePersonhoodArgsSchema,
            userIndexSubmitProofOfUniquePersonhoodResponseSchema,
        );
    }
}
