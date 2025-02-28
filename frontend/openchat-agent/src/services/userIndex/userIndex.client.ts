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
    UsersApiResponse,
    UserSummaryUpdate,
    ChitState,
    SubmitProofOfUniquePersonhoodResponse,
    ChitLeaderboardResponse,
    ExternalAchievementsResponse,
    ExploreBotsResponse,
    ExternalBot,
    BotsResponse,
    BotDefinition,
    BotInstallationLocation,
} from "openchat-shared";
import {
    mergeUserSummaryWithUpdates,
    offline,
    Stream,
    userSummaryFromCurrentUserSummary,
} from "openchat-shared";
import { MsgpackCanisterAgent } from "../canisterAgent/msgpack";
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
    externalAchievementsResponse,
    exploreBotsResponse,
    botUpdatesResponse,
    apiBotDefinition,
    apiBotInstallLocation,
} from "./mappers";
import {
    getCachedUsers,
    getCachedDeletedUserIds,
    getSuspendedUsersSyncedUpTo,
    setCachedDeletedUserIds,
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
import {
    identity,
    mapOptional,
    principalBytesToString,
    principalStringToBytes,
} from "../../utils/mapping";
import {
    Empty,
    UserIndexBotUpdatesArgs,
    UserIndexBotUpdatesResponse,
    UserIndexCheckUsernameArgs,
    UserIndexCheckUsernameResponse,
    UserIndexChitLeaderboardResponse,
    UserIndexCurrentUserResponse,
    UserIndexDeleteUserArgs,
    UserIndexDeleteUserResponse,
    UserIndexDiamondMembershipFeesResponse,
    UserIndexExploreBotsArgs,
    UserIndexExploreBotsResponse,
    UserIndexExternalAchievementsArgs,
    UserIndexExternalAchievementsResponse,
    UserIndexPayForDiamondMembershipArgs,
    UserIndexPayForDiamondMembershipResponse,
    UserIndexPlatformModeratorsGroupResponse,
    UserIndexRegisterBotArgs,
    UserIndexRegisterBotResponse,
    UserIndexRemoveBotArgs,
    UserIndexRemoveBotResponse,
    UserIndexReportedMessagesArgs,
    UserIndexReportedMessagesResponse,
    UserIndexSearchArgs,
    UserIndexSearchResponse,
    UserIndexSetDiamondMembershipFeesArgs,
    UserIndexSetDiamondMembershipFeesResponse,
    UserIndexSetDisplayNameArgs,
    UserIndexSetDisplayNameResponse,
    UserIndexSetModerationFlagsArgs,
    UserIndexSetModerationFlagsResponse,
    UserIndexSetUsernameArgs,
    UserIndexSetUsernameResponse,
    UserIndexSetUserUpgradeConcurrencyArgs,
    UserIndexSetUserUpgradeConcurrencyResponse,
    UserIndexSubmitProofOfUniquePersonhoodArgs,
    UserIndexSubmitProofOfUniquePersonhoodResponse,
    UserIndexSuspendUserArgs,
    UserIndexSuspendUserResponse,
    UserIndexUnsuspendUserArgs,
    UserIndexUnsuspendUserResponse,
    UserIndexUpdateBotArgs,
    UserIndexUpdateBotResponse,
    UserIndexUserRegistrationCanisterResponse,
    UserIndexUsersArgs,
    UserIndexUsersResponse,
} from "../../typebox";
import { apiToken } from "../common/chatMappersV2";
import type { DelegationChain } from "@dfinity/identity";
import { signedDelegation } from "../../utils/id";

export class UserIndexClient extends MsgpackCanisterAgent {
    constructor(
        identity: Identity,
        agent: HttpAgent,
        canisterId: string,
        private blobUrlPattern: string,
    ) {
        super(identity, agent, canisterId, "UserIndex");
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
                        UserIndexCurrentUserResponse,
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
            UserIndexSetModerationFlagsArgs,
            UserIndexSetModerationFlagsResponse,
        );
    }

    userRegistrationCanister(): Promise<string> {
        return this.executeMsgpackQuery(
            "user_registration_canister",
            {},
            userRegistrationCanisterResponse,
            Empty,
            UserIndexUserRegistrationCanisterResponse,
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
            UserIndexSearchArgs,
            UserIndexSearchResponse,
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

        setCachedDeletedUserIds(apiResponse.deletedUserIds);

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
                users: users.map(principalStringToBytes),
                updated_since: updatedSince,
            })),
            users_suspended_since: suspendedUsersSyncedUpTo,
        };

        return this.executeMsgpackQuery(
            "users",
            args,
            usersApiResponse,
            UserIndexUsersArgs,
            UserIndexUsersResponse,
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

    checkUsername(username: string, isBot: boolean): Promise<CheckUsernameResponse> {
        const args = {
            username: username,
            is_bot: isBot,
        };
        return this.executeMsgpackQuery(
            "check_username",
            args,
            checkUsernameResponse,
            UserIndexCheckUsernameArgs,
            UserIndexCheckUsernameResponse,
        );
    }

    setUsername(userId: string, username: string): Promise<SetUsernameResponse> {
        return this.executeMsgpackUpdate(
            "set_username",
            { username },
            setUsernameResponse,
            UserIndexSetUsernameArgs,
            UserIndexSetUsernameResponse,
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
        return this.executeMsgpackUpdate(
            "set_display_name",
            {
                display_name: displayName,
            },
            setDisplayNameResponse,
            UserIndexSetDisplayNameArgs,
            UserIndexSetDisplayNameResponse,
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
                user_id: principalStringToBytes(userId),
                reason,
            },
            suspendUserResponse,
            UserIndexSuspendUserArgs,
            UserIndexSuspendUserResponse,
        );
    }

    unsuspendUser(userId: string): Promise<UnsuspendUserResponse> {
        return this.executeMsgpackUpdate(
            "unsuspend_user",
            {
                user_id: principalStringToBytes(userId),
            },
            unsuspendUserResponse,
            UserIndexUnsuspendUserArgs,
            UserIndexUnsuspendUserResponse,
        );
    }

    payForDiamondMembership(
        userId: string,
        token: string,
        duration: DiamondMembershipDuration,
        recurring: boolean,
        expectedPriceE8s: bigint,
    ): Promise<PayForDiamondMembershipResponse> {
        return this.executeMsgpackUpdate(
            "pay_for_diamond_membership",
            {
                token: apiToken(token),
                duration: apiJsonDiamondDuration(duration),
                recurring,
                expected_price_e8s: expectedPriceE8s,
            },
            (res) => payForDiamondMembershipResponse(duration, res),
            UserIndexPayForDiamondMembershipArgs,
            UserIndexPayForDiamondMembershipResponse,
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
            UserIndexSetUserUpgradeConcurrencyArgs,
            UserIndexSetUserUpgradeConcurrencyResponse,
        );
    }

    getPlatformModeratorGroup(): Promise<string> {
        return this.executeMsgpackQuery(
            "platform_moderators_group",
            {},
            (res) => principalBytesToString(res.Success),
            Empty,
            UserIndexPlatformModeratorsGroupResponse,
        );
    }

    diamondMembershipFees(): Promise<DiamondMembershipFees[]> {
        return this.executeMsgpackQuery(
            "diamond_membership_fees",
            {},
            diamondMembershipFeesResponse,
            Empty,
            UserIndexDiamondMembershipFeesResponse,
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
            UserIndexSetDiamondMembershipFeesArgs,
            UserIndexSetDiamondMembershipFeesResponse,
        );
    }

    reportedMessages(userId: string | undefined): Promise<string> {
        return this.executeMsgpackQuery(
            "reported_messages",
            {
                user_id: mapOptional(userId, principalStringToBytes),
            },
            (res) => res.Success.json,
            UserIndexReportedMessagesArgs,
            UserIndexReportedMessagesResponse,
        );
    }

    chitLeaderboard(): Promise<ChitLeaderboardResponse> {
        return this.executeMsgpackQuery(
            "chit_leaderboard",
            {},
            chitLeaderboardResponse,
            Empty,
            UserIndexChitLeaderboardResponse,
        );
    }

    submitProofOfUniquePersonhood(
        iiPrincipal: string,
        credential: string,
    ): Promise<SubmitProofOfUniquePersonhoodResponse> {
        const args = {
            user_ii_principal: principalStringToBytes(iiPrincipal),
            credential_jwt: credential,
        };
        return this.executeMsgpackUpdate(
            "submit_proof_of_unique_personhood",
            args,
            submitProofOfUniquePersonhoodResponse,
            UserIndexSubmitProofOfUniquePersonhoodArgs,
            UserIndexSubmitProofOfUniquePersonhoodResponse,
        );
    }

    getExternalAchievements(updatesSince: bigint): Promise<ExternalAchievementsResponse> {
        return this.executeMsgpackQuery(
            "external_achievements",
            { updates_since: updatesSince },
            externalAchievementsResponse,
            UserIndexExternalAchievementsArgs,
            UserIndexExternalAchievementsResponse,
        );
    }

    deleteUser(userId: string, delegation: DelegationChain): Promise<boolean> {
        return this.executeMsgpackUpdate(
            "delete_user",
            { user_id: principalStringToBytes(userId), delegation: signedDelegation(delegation) },
            (resp) => resp === "Success",
            UserIndexDeleteUserArgs,
            UserIndexDeleteUserResponse,
        );
    }

    exploreBots(
        searchTerm: string | undefined,
        pageIndex: number,
        pageSize: number,
        location?: BotInstallationLocation,
    ): Promise<ExploreBotsResponse> {
        return this.executeMsgpackQuery(
            "explore_bots",
            {
                search_term: searchTerm,
                page_index: pageIndex,
                page_size: pageSize,
                installation_location: mapOptional(location, apiBotInstallLocation),
            },
            (resp) => exploreBotsResponse(resp, this.blobUrlPattern, this.canisterId),
            UserIndexExploreBotsArgs,
            UserIndexExploreBotsResponse,
        );
    }

    registerBot(principal: string, bot: ExternalBot): Promise<boolean> {
        const location =
            bot.registrationStatus.kind === "private" ? bot.registrationStatus.location : undefined;
        return this.executeMsgpackUpdate(
            "register_bot",
            {
                principal: principalStringToBytes(principal),
                owner: principalStringToBytes(bot.ownerId),
                name: bot.name,
                avatar: mapOptional(bot.avatarUrl, identity),
                endpoint: bot.endpoint,
                definition: apiBotDefinition(bot.definition),
                permitted_install_location: mapOptional(location, apiBotInstallLocation),
            },
            (resp) => {
                console.log("UserIndex register bot response: ", resp);
                return true;
            },
            UserIndexRegisterBotArgs,
            UserIndexRegisterBotResponse,
        );
    }

    removeBot(botId: string): Promise<boolean> {
        return this.executeMsgpackUpdate(
            "remove_bot",
            {
                bot_id: principalStringToBytes(botId),
            },
            (resp) => {
                console.log("UserIndex remove bot response: ", resp);
                return resp === "Success";
            },
            UserIndexRemoveBotArgs,
            UserIndexRemoveBotResponse,
        );
    }

    updateRegisteredBot(
        id: string,
        principal?: string,
        ownerId?: string,
        avatarUrl?: string,
        endpoint?: string,
        definition?: BotDefinition,
    ): Promise<boolean> {
        return this.executeMsgpackUpdate(
            "update_bot",
            {
                bot_id: principalStringToBytes(id),
                owner: mapOptional(ownerId, principalStringToBytes),
                principal: mapOptional(principal, principalStringToBytes),
                avatar:
                    mapOptional(avatarUrl, (url) => ({
                        SetToSome: url,
                    })) ?? "NoChange",
                endpoint: mapOptional(endpoint, identity),
                definition: mapOptional(definition, apiBotDefinition),
            },
            (resp) => {
                console.log("UserIndex update bot response: ", resp);
                return true;
            },
            UserIndexUpdateBotArgs,
            UserIndexUpdateBotResponse,
        );
    }

    getBots(current: BotsResponse | undefined): Promise<BotsResponse> {
        return this.executeMsgpackQuery(
            "bot_updates",
            {
                updated_since: current?.timestamp ?? 0n,
            },
            (resp) => botUpdatesResponse(resp, current, this.blobUrlPattern, this.canisterId),
            UserIndexBotUpdatesArgs,
            UserIndexBotUpdatesResponse,
        );
    }
}
