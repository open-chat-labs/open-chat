import { groupBy } from "../../utils/list";
import type { Identity } from "@dfinity/agent";
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
    ClaimDailyChitResponse,
    ChitUserBalance,
} from "openchat-shared";
import { offline, Stream } from "openchat-shared";
import { CandidService } from "../candidService";
import {
    checkUsernameResponse,
    setUsernameResponse,
    currentUserResponse,
    usersResponse,
    userSearchResponse,
    suspendUserResponse,
    unsuspendUserResponse,
    apiDiamondDuration,
    payForDiamondMembershipResponse,
    referralLeaderboardResponse,
    userRegistrationCanisterResponse,
    setDisplayNameResponse,
    diamondMembershipFeesResponse,
    claimDailyChitResponse,
    chitLeaderboardResponse,
} from "./mappers";
import { apiOptional, apiToken } from "../common/chatMappers";
import type { AgentConfig } from "../../config";
import {
    getCachedUsers,
    getSuspendedUsersSyncedUpTo,
    setCachedUsers,
    setDisplayNameInCache,
    setSuspendedUsersSyncedUpTo,
    setUserDiamondStatusInCache,
    setUsernameInCache,
} from "../../utils/userCache";
import { identity } from "../../utils/mapping";
import {
    getCachedCurrentUser,
    setCachedCurrentUser,
    setCurrentUserDiamondStatusInCache,
} from "../../utils/caching";

export class UserIndexClient extends CandidService {
    private userIndexService: UserIndexService;

    constructor(identity: Identity, config: AgentConfig) {
        super(identity);

        this.userIndexService = this.createServiceClient<UserIndexService>(
            idlFactory,
            config.userIndexCanister,
            config,
        );
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

    async getUsers(users: UsersArgs, allowStale: boolean): Promise<UsersResponse> {
        const allUsers = users.userGroups.flatMap((g) => g.users);

        const fromCache = await getCachedUsers(allUsers);
        const suspendedUsersSyncedTo = await getSuspendedUsersSyncedUpTo();

        // We throw away all of the updatedSince values passed in and instead use the values from the cache, this
        // ensures the cache is always correct and doesn't miss any updates
        const args = this.buildGetUsersArgs(allUsers, fromCache, allowStale);

        const response = await this.getUsersFromBackend(users, suspendedUsersSyncedTo);

        const requestedFromServer = new Set<string>([...args.userGroups.flatMap((g) => g.users)]);

        // We return the fully hydrated users so that it is not possible for the Svelte store to miss any updates
        const mergedResponse = this.mergeGetUsersResponse(
            allUsers,
            requestedFromServer,
            response,
            fromCache,
        );

        setCachedUsers(mergedResponse.users).catch((err) =>
            console.error("Failed to save users to the cache", err),
        );

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
    ): Promise<UsersResponse> {
        if (offline())
            return Promise.resolve({
                users: [],
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
            () => this.userIndexService.users_v2(args),
            usersResponse,
            args,
        );
    }

    private buildGetUsersArgs(
        users: string[],
        fromCache: UserSummary[],
        allowStale: boolean,
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
        fromCache: UserSummary[],
    ): UsersResponse {
        if (fromCache.length === 0) {
            return response;
        }

        const fromCacheMap = new Map<string, UserSummary>(fromCache.map((u) => [u.userId, u]));
        const responseMap = new Map<string, UserSummary>(response.users.map((u) => [u.userId, u]));

        const users: UserSummary[] = [];

        for (const userId of allUsers) {
            const cached = fromCacheMap.get(userId);
            const fromServer = responseMap.get(userId);

            if (fromServer !== undefined) {
                responseMap.delete(userId);
                users.push(fromServer);
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

        // This is needed because newly suspended users won't have been included in the `allUsers` array
        for (const user of responseMap.values()) {
            users.push(user);
        }

        return {
            serverTimestamp: response.serverTimestamp,
            users,
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
            (res) => "Success" in res,
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

    claimDailyChit(): Promise<ClaimDailyChitResponse> {
        return this.handleQueryResponse(
            () => this.userIndexService.claim_daily_chit({}),
            claimDailyChitResponse,
        );
    }

    chitLeaderboard(): Promise<ChitUserBalance[]> {
        return this.handleQueryResponse(
            () => this.userIndexService.chit_leaderboard({}),
            chitLeaderboardResponse,
        );
    }
}
