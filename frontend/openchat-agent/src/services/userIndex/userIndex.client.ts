import type { Identity } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { idlFactory, UserIndexService } from "./candid/idl";
import type {
    CheckUsernameResponse,
    ConfirmPhoneNumberResponse,
    CurrentUserResponse,
    SubmitPhoneNumberResponse,
    SetUsernameResponse,
    PhoneNumber,
    ResendCodeResponse,
    UsersArgs,
    UsersResponse,
    UserSummary,
    RegisterUserResponse,
    UpgradeStorageResponse,
    ChallengeAttempt,
    CreateChallengeResponse,
    SuspendUserResponse,
    UnsuspendUserResponse,
    MarkSuspectedBotResponse,
    Cryptocurrency,
    DiamondMembershipDuration,
    PayForDiamondMembershipResponse,
} from "openchat-shared";
import { CandidService } from "../candidService";
import {
    checkUsernameResponse,
    setUsernameResponse,
    createChallengeResponse,
    currentUserResponse,
    submitPhoneNumberResponse,
    confirmPhoneNumber,
    resendCodeResponse,
    usersResponse,
    userSearchResponse,
    registerUserResponse,
    upgradeStorageResponse,
    suspendUserResponse,
    unsuspendUserResponse,
    apiCryptocurrency,
    apiDiamondDuration,
    payForDiamondMembershipResponse,
} from "./mappers";
import { CachingUserIndexClient } from "./userIndex.caching.client";
import type { IUserIndexClient } from "./userIndex.client.interface";
import { profile } from "../common/profiling";
import { apiOptional } from "../common/chatMappers";
import type { AgentConfig } from "../../config";

export class UserIndexClient extends CandidService implements IUserIndexClient {
    private userService: UserIndexService;

    private constructor(identity: Identity, config: AgentConfig) {
        super(identity);

        this.userService = this.createServiceClient<UserIndexService>(
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
            () => this.userService.current_user({}),
            currentUserResponse
        );
    }

    @profile("userIndexClient")
    createChallenge(): Promise<CreateChallengeResponse> {
        return this.handleQueryResponse(
            () => this.userService.create_challenge({}),
            createChallengeResponse
        );
    }

    @profile("userIndexClient")
    registerUser(
        username: string,
        challengeAttempt: ChallengeAttempt,
        referredBy: string | undefined
    ): Promise<RegisterUserResponse> {
        return this.handleResponse(
            this.userService.register_user({
                username,
                challenge_attempt: challengeAttempt,
                referred_by: apiOptional((userId) => Principal.fromText(userId), referredBy),
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
            () => this.userService.search(args),
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
        return this.handleQueryResponse(() => this.userService.users(args), usersResponse, args);
    }

    @profile("userIndexClient")
    upgradeStorage(newLimitBytes: number): Promise<UpgradeStorageResponse> {
        return this.handleResponse(
            this.userService.upgrade_storage({
                new_storage_limit_bytes: BigInt(newLimitBytes),
            }),
            upgradeStorageResponse
        );
    }

    @profile("userIndexClient")
    resendRegistrationCode(): Promise<ResendCodeResponse> {
        return this.handleResponse(this.userService.resend_code({}), resendCodeResponse);
    }

    @profile("userIndexClient")
    checkUsername(username: string): Promise<CheckUsernameResponse> {
        const args = {
            username: username,
        };
        return this.handleQueryResponse(
            () => this.userService.check_username(args),
            checkUsernameResponse,
            args
        );
    }

    @profile("userIndexClient")
    setUsername(_userId: string, username: string): Promise<SetUsernameResponse> {
        return this.handleResponse(
            this.userService.set_username({
                username: username,
            }),
            setUsernameResponse
        );
    }

    @profile("userIndexClient")
    submitPhoneNumber(phoneNumber: PhoneNumber): Promise<SubmitPhoneNumberResponse> {
        return this.handleResponse(
            this.userService.submit_phone_number({
                phone_number: {
                    country_code: phoneNumber.countryCode,
                    number: phoneNumber.number,
                },
            }),
            submitPhoneNumberResponse
        );
    }

    @profile("userIndexClient")
    confirmPhoneNumber(code: string): Promise<ConfirmPhoneNumberResponse> {
        return this.handleResponse(
            this.userService.confirm_phone_number({
                confirmation_code: code,
            }),
            confirmPhoneNumber
        );
    }

    @profile("userIndexClient")
    suspendUser(userId: string, reason: string): Promise<SuspendUserResponse> {
        return this.handleResponse(
            this.userService.suspend_user({
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
            this.userService.unsuspend_user({
                user_id: Principal.fromText(userId),
            }),
            unsuspendUserResponse
        );
    }

    @profile("userIndexClient")
    markSuspectedBot(): Promise<MarkSuspectedBotResponse> {
        return this.handleResponse(this.userService.mark_suspected_bot({}), () => "success");
    }

    @profile("userIndexClient")
    payForDiamondMembership(
        token: Cryptocurrency,
        duration: DiamondMembershipDuration,
        recurring: boolean,
        expectedPriceE8s: bigint
    ): Promise<PayForDiamondMembershipResponse> {
        return this.handleResponse(
            this.userService.pay_for_diamond_membership({
                token: apiCryptocurrency(token),
                duration: apiDiamondDuration(duration),
                recurring,
                expected_price_e8s: expectedPriceE8s,
            }),
            payForDiamondMembershipResponse
        );
    }
}
