import { groupBy } from "../../utils/list";
import type { HttpAgent, Identity } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { idlFactory, type UserIndexService } from "./candid/idl";
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
    currentUserResponse,
    usersApiResponse,
    userSearchResponse,
    suspendUserResponse,
    unsuspendUserResponse,
    apiDiamondDuration,
    payForDiamondMembershipResponse,
    referralLeaderboardResponse,
    userRegistrationCanisterResponse,
    setDisplayNameResponse,
    diamondMembershipFeesResponse,
    chitLeaderboardResponse,
    submitProofOfUniquePersonhoodResponse,
} from "./mappers";
import { apiOptional, apiToken } from "../common/chatMappers";
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
import { identity } from "../../utils/mapping";
import {
    getCachedCurrentUser,
    mergeCachedCurrentUser,
    setCachedCurrentUser,
    setCurrentUserDiamondStatusInCache,
} from "../../utils/caching";

export class UserIndexClient extends CandidService {
    private userIndexService: UserIndexService;

    constructor(identity: Identity, agent: HttpAgent, canisterId: string) {
        super(identity, agent, canisterId);

        this.userIndexService = this.createServiceClient<UserIndexService>(idlFactory);
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
                    const liveUser = await this.handleQueryResponse(
                        () => this.userIndexService.current_user({}),
                        currentUserResponse,
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
        return this.handleResponse(
            this.userIndexService.set_moderation_flags({
                moderation_flags_enabled: flags,
            }),
            (_) => true,
        );
    }

    userRegistrationCanister(): Promise<string> {
        return this.handleResponse(
            this.userIndexService.user_registration_canister({}),
            userRegistrationCanisterResponse,
        );
    }

    searchUsers(searchTerm: string, maxResults = 20): Promise<UserSummary[]> {
        const args = {
            search_term: searchTerm,
            max_results: maxResults,
        };
        return this.handleQueryResponse(
            () => this.userIndexService.search(args),
            userSearchResponse,
            args,
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
                users: users.map((u) => Principal.fromText(u)),
                updated_since: updatedSince,
            })),
            users_suspended_since: apiOptional(identity, suspendedUsersSyncedUpTo),
        };

        return this.handleQueryResponse(
            () => this.userIndexService.users(args),
            usersApiResponse,
            args,
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
        return this.handleQueryResponse(
            () => this.userIndexService.check_username(args),
            checkUsernameResponse,
            args,
        );
    }

    setUsername(userId: string, username: string): Promise<SetUsernameResponse> {
        return this.handleResponse(
            this.userIndexService.set_username({ username }),
            setUsernameResponse,
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
        return this.handleResponse(
            this.userIndexService.set_display_name({
                display_name: apiOptional(identity, displayName),
            }),
            setDisplayNameResponse,
        ).then((res) => {
            if (res === "success") {
                setDisplayNameInCache(userId, displayName);
            }
            return res;
        });
    }

    suspendUser(userId: string, reason: string): Promise<SuspendUserResponse> {
        return this.handleResponse(
            this.userIndexService.suspend_user({
                user_id: Principal.fromText(userId),
                duration: [],
                reason,
            }),
            suspendUserResponse,
        );
    }

    unsuspendUser(userId: string): Promise<UnsuspendUserResponse> {
        return this.handleResponse(
            this.userIndexService.unsuspend_user({
                user_id: Principal.fromText(userId),
            }),
            unsuspendUserResponse,
        );
    }

    payForDiamondMembership(
        userId: string,
        token: string,
        duration: DiamondMembershipDuration,
        recurring: boolean,
        expectedPriceE8s: bigint,
    ): Promise<PayForDiamondMembershipResponse> {
        return this.handleResponse(
            this.userIndexService.pay_for_diamond_membership({
                token: apiToken(token),
                duration: apiDiamondDuration(duration),
                recurring,
                expected_price_e8s: expectedPriceE8s,
            }),
            (res) => payForDiamondMembershipResponse(duration, res),
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
        return this.handleResponse(
            this.userIndexService.set_user_upgrade_concurrency({ value }),
            () => "success",
        );
    }

    getReferralLeaderboard(req?: ReferralLeaderboardRange): Promise<ReferralLeaderboardResponse> {
        return this.handleResponse(
            this.userIndexService.referral_leaderboard({
                count: 10,
                filter: apiOptional((r) => {
                    return {
                        Month: {
                            year: r.year,
                            month: r.month,
                        },
                    };
                }, req),
            }),
            referralLeaderboardResponse,
        );
    }

    getPlatformModeratorGroup(): Promise<string> {
        return this.handleResponse(this.userIndexService.platform_moderators_group({}), (res) =>
            res.Success.toString(),
        );
    }

    diamondMembershipFees(): Promise<DiamondMembershipFees[]> {
        return this.handleQueryResponse(
            () => this.userIndexService.diamond_membership_fees({}),
            diamondMembershipFeesResponse,
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

        return this.handleQueryResponse(
            () => this.userIndexService.set_diamond_membership_fees(args),
            (res) => {
                return "Success" in res;
            },
        );
    }

    reportedMessages(userId: string | undefined): Promise<string> {
        return this.handleQueryResponse(
            () =>
                this.userIndexService.reported_messages({
                    user_id: userId !== undefined ? [Principal.fromText(userId)] : [],
                }),
            (res) => res.Success.json,
        );
    }

    chitLeaderboard(): Promise<ChitUserBalance[]> {
        return this.handleQueryResponse(
            () => this.userIndexService.chit_leaderboard({}),
            chitLeaderboardResponse,
        );
    }

    submitProofOfUniquePersonhood(
        iiPrincipal: string,
        credential: string,
    ): Promise<SubmitProofOfUniquePersonhoodResponse> {
        return this.handleResponse(
            this.userIndexService.submit_proof_of_unique_personhood({
                user_ii_principal: Principal.fromText(iiPrincipal),
                credential_jwt: credential,
            }),
            submitProofOfUniquePersonhoodResponse,
        );
    }
}
