import type { Identity, SignIdentity } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { identity } from "../../utils/mapping";
import { idlFactory, UserIndexService } from "./candid/idl";
import type {
    CheckUsernameResponse,
    CurrentUserResponse,
    SetUsernameResponse,
    UsersArgs,
    UsersResponse,
    UserSummary,
    RegisterUserResponse,
    SuspendUserResponse,
    UnsuspendUserResponse,
    MarkSuspectedBotResponse,
    Cryptocurrency,
    DiamondMembershipDuration,
    PayForDiamondMembershipResponse,
    SetUserUpgradeConcurrencyResponse,
    ReferralLeaderboardRange,
    ReferralLeaderboardResponse,
} from "openchat-shared";
import { CandidService } from "../candidService";
import {
    checkUsernameResponse,
    setUsernameResponse,
    currentUserResponse,
    usersResponse,
    userSearchResponse,
    registerUserResponse,
    suspendUserResponse,
    unsuspendUserResponse,
    apiCryptocurrency,
    apiDiamondDuration,
    payForDiamondMembershipResponse,
    referralLeaderboardResponse,
    userRegistrationCanisterResponse,
} from "./mappers";
import { CachingUserIndexClient } from "./userIndex.caching.client";
import type { IUserIndexClient } from "./userIndex.client.interface";
import { profile } from "../common/profiling";
import { apiOptional } from "../common/chatMappers";
import type { AgentConfig } from "../../config";

export class UserIndexClient extends CandidService implements IUserIndexClient {
    private userIndexService: UserIndexService;

    private constructor(identity: Identity, config: AgentConfig) {
        super(identity);

        this.userIndexService = this.createServiceClient<UserIndexService>(
            idlFactory,
            config.userIndexCanister,
            config
        );
    }

    static create(identity: Identity, config: AgentConfig): IUserIndexClient {
        return new CachingUserIndexClient(new UserIndexClient(identity, config), config.logger);
    }

    @profile("userIndexClient")
    getCurrentUser(): Promise<CurrentUserResponse> {
        return this.handleQueryResponse(
            () => this.userIndexService.current_user({}),
            currentUserResponse
        );
    }

    @profile("userIndexClient")
    userRegistrationCanister(): Promise<string> {
        return this.handleResponse(
            this.userIndexService.user_registration_canister({}),
            userRegistrationCanisterResponse
        );
    }

    @profile("userIndexClient")
    registerUser(
        username: string,
        referralCode: string | undefined
    ): Promise<RegisterUserResponse> {
        return this.handleResponse(
            this.userIndexService.register_user_v2({
                username,
                referral_code: apiOptional(identity, referralCode),
                public_key: new Uint8Array((this.identity as SignIdentity).getPublicKey().toDer()),
            }),
            registerUserResponse
        );
    }

    @profile("userIndexClient")
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

    @profile("userIndexClient")
    getUsers(users: UsersArgs, _allowStale: boolean): Promise<UsersResponse> {
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

    @profile("userIndexClient")
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

    @profile("userIndexClient")
    setUsername(_userId: string, username: string): Promise<SetUsernameResponse> {
        return this.handleResponse(
            this.userIndexService.set_username({
                username: username,
            }),
            setUsernameResponse
        );
    }

    @profile("userIndexClient")
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

    @profile("userIndexClient")
    unsuspendUser(userId: string): Promise<UnsuspendUserResponse> {
        return this.handleResponse(
            this.userIndexService.unsuspend_user({
                user_id: Principal.fromText(userId),
            }),
            unsuspendUserResponse
        );
    }

    @profile("userIndexClient")
    markSuspectedBot(): Promise<MarkSuspectedBotResponse> {
        return this.handleResponse(this.userIndexService.mark_suspected_bot({}), () => "success");
    }

    @profile("userIndexClient")
    payForDiamondMembership(
        _userId: string,
        token: Cryptocurrency,
        duration: DiamondMembershipDuration,
        recurring: boolean,
        expectedPriceE8s: bigint
    ): Promise<PayForDiamondMembershipResponse> {
        return this.handleResponse(
            this.userIndexService.pay_for_diamond_membership({
                token: apiCryptocurrency(token),
                duration: apiDiamondDuration(duration),
                recurring,
                expected_price_e8s: expectedPriceE8s,
            }),
            payForDiamondMembershipResponse
        );
    }

    @profile("userIndexClient")
    setUserUpgradeConcurrency(value: number): Promise<SetUserUpgradeConcurrencyResponse> {
        return this.handleResponse(
            this.userIndexService.set_user_upgrade_concurrency({ value }),
            () => "success"
        );
    }

    @profile("userIndexClient")
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

    @profile("userIndexClient")
    getPlatformModeratorGroup(): Promise<string> {
        return this.handleResponse(this.userIndexService.platform_moderators_group({}), (res) =>
            res.Success.toString()
        );
    }
}
