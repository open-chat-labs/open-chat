import { groupBy } from "../../utils/list";
import type { Identity } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { idlFactory, UserIndexService } from "./candid/idl";
import type {
    CheckUsernameResponse,
    CurrentUserResponse,
    SetUsernameResponse,
    UsersArgs,
    UsersResponse,
    UserSummary,
    SuspendUserResponse,
    UnsuspendUserResponse,
    MarkSuspectedBotResponse,
    Cryptocurrency,
    DiamondMembershipDuration,
    PayForDiamondMembershipResponse,
    SetUserUpgradeConcurrencyResponse,
    ReferralLeaderboardRange,
    ReferralLeaderboardResponse,
    PartialUserSummary,
} from "openchat-shared";
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
} from "./mappers";
import { apiOptional, apiToken } from "../common/chatMappers";
import type { AgentConfig } from "../../config";
import {
    getCachedUsers,
    setCachedUsers,
    setUserDiamondStatusToTrueInCache,
    setUsernameInCache,
} from "../../utils/userCache";

export class UserIndexClient extends CandidService {
    private userIndexService: UserIndexService;

    constructor(identity: Identity, config: AgentConfig) {
        super(identity);

        this.userIndexService = this.createServiceClient<UserIndexService>(
            idlFactory,
            config.userIndexCanister,
            config
        );
    }

    getCurrentUser(): Promise<CurrentUserResponse> {
        return this.handleQueryResponse(
            () => this.userIndexService.current_user({}),
            currentUserResponse
        );
    }

    setModerationFlags(flags: number): Promise<boolean> {
        return this.handleResponse(
            this.userIndexService.set_moderation_flags({
                moderation_flags_enabled: flags,
            }),
            (_) => true
        );
    }

    userRegistrationCanister(): Promise<string> {
        return this.handleResponse(
            this.userIndexService.user_registration_canister({}),
            userRegistrationCanisterResponse
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
            args
        );
    }

    async getUsers(users: UsersArgs, allowStale: boolean): Promise<UsersResponse> {
        const allUsers = users.userGroups.flatMap((g) => g.users);

        const fromCache = await getCachedUsers(allUsers);

        // We throw away all of the updatedSince values passed in and instead use the values from the cache, this
        // ensures the cache is always correct and doesn't miss any updates
        const args = this.buildGetUsersArgs(allUsers, fromCache, allowStale);

        const response = await this.getUsersFromBackend(users);

        const requestedFromServer = new Set<string>([...args.userGroups.flatMap((g) => g.users)]);

        // We return the fully hydrated users so that it is not possible for the Svelte store to miss any updates
        const mergedResponse = this.mergeGetUsersResponse(
            allUsers,
            requestedFromServer,
            response,
            fromCache
        );

        setCachedUsers(mergedResponse.users.filter(this.isUserSummary)).catch((err) =>
            console.error("Failed to save users to the cache", err)
        );

        return mergedResponse;
    }

    private getUsersFromBackend(users: UsersArgs): Promise<UsersResponse> {
        const userGroups = users.userGroups.filter((g) => g.users.length > 0);

        if (userGroups.length === 0) {
            return Promise.resolve({
                serverTimestamp: undefined,
                users: [],
            });
        }
        const args = {
            user_groups: userGroups.map(({ users, updatedSince }) => ({
                users: users.map((u) => Principal.fromText(u)),
                updated_since: updatedSince,
            })),
        };
        return this.handleQueryResponse(
            () => this.userIndexService.users(args),
            usersResponse,
            args
        );
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

    private isUserSummary(user: PartialUserSummary): user is UserSummary {
        return user.username !== undefined;
    }

    checkUsername(username: string): Promise<CheckUsernameResponse> {
        const args = {
            username: username,
        };
        return this.handleQueryResponse(
            () => this.userIndexService.check_username(args),
            checkUsernameResponse,
            args
        );
    }

    setUsername(userId: string, username: string): Promise<SetUsernameResponse> {
        return this.handleResponse(
            this.userIndexService.set_username({
                username: username,
            }),
            setUsernameResponse
        ).then((res) => {
            if (res === "success") {
                setUsernameInCache(userId, username);
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
            suspendUserResponse
        );
    }

    unsuspendUser(userId: string): Promise<UnsuspendUserResponse> {
        return this.handleResponse(
            this.userIndexService.unsuspend_user({
                user_id: Principal.fromText(userId),
            }),
            unsuspendUserResponse
        );
    }

    markSuspectedBot(): Promise<MarkSuspectedBotResponse> {
        return this.handleResponse(this.userIndexService.mark_suspected_bot({}), () => "success");
    }

    payForDiamondMembership(
        userId: string,
        token: Cryptocurrency,
        duration: DiamondMembershipDuration,
        recurring: boolean,
        expectedPriceE8s: bigint
    ): Promise<PayForDiamondMembershipResponse> {
        return this.handleResponse(
            this.userIndexService.pay_for_diamond_membership({
                token: apiToken(token),
                duration: apiDiamondDuration(duration),
                recurring,
                expected_price_e8s: expectedPriceE8s,
            }),
            payForDiamondMembershipResponse
        ).then((res) => {
            if (res.kind === "success") {
                setUserDiamondStatusToTrueInCache(userId);
            }
            return res;
        });
    }

    setUserUpgradeConcurrency(value: number): Promise<SetUserUpgradeConcurrencyResponse> {
        return this.handleResponse(
            this.userIndexService.set_user_upgrade_concurrency({ value }),
            () => "success"
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
            referralLeaderboardResponse
        );
    }

    getPlatformModeratorGroup(): Promise<string> {
        return this.handleResponse(this.userIndexService.platform_moderators_group({}), (res) =>
            res.Success.toString()
        );
    }
}
