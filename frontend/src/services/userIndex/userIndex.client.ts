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
} from "../../domain/user/user";
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
} from "./mappers";
import { CachingUserIndexClient } from "./userIndex.caching.client";
import type { IUserIndexClient } from "./userIndex.client.interface";
import type { Database } from "../../utils/caching";

export class UserIndexClient extends CandidService implements IUserIndexClient {
    private userService: UserIndexService;

    private constructor(identity: Identity) {
        super(identity);

        this.userService = this.createServiceClient<UserIndexService>(
            idlFactory,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            "process.env.USER_INDEX_CANISTER"
        );
    }

    static create(identity: Identity, db?: Database): IUserIndexClient {
        return db && process.env.CLIENT_CACHING
            ? new CachingUserIndexClient(db, new UserIndexClient(identity))
            : new UserIndexClient(identity);
    }

    getCurrentUser(): Promise<CurrentUserResponse> {
        return this.handleQueryResponse(
            () => this.userService.current_user({}),
            currentUserResponse
        );
    }

    createChallenge(): Promise<CreateChallengeResponse> {
        return this.handleQueryResponse(
            () => this.userService.create_challenge({}),
            createChallengeResponse
        );
    }

    registerUser(
        username: string,
        challengeAttempt: ChallengeAttempt
    ): Promise<RegisterUserResponse> {
        return this.handleResponse(
            this.userService.register_user({
                username,
                challenge_attempt: challengeAttempt,
            }),
            registerUserResponse
        );
    }

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

    getUsers(users: UsersArgs): Promise<UsersResponse> {
        const userGroups = users.userGroups.filter((g) => g.users.length > 0);

        if (userGroups.length === 0) {
            return Promise.resolve({
                timestamp: BigInt(Date.now()),
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

    upgradeStorage(newLimitBytes: number): Promise<UpgradeStorageResponse> {
        return this.handleResponse(
            this.userService.upgrade_storage({
                new_storage_limit_bytes: BigInt(newLimitBytes),
            }),
            upgradeStorageResponse
        );
    }

    resendRegistrationCode(): Promise<ResendCodeResponse> {
        return this.handleResponse(this.userService.resend_code({}), resendCodeResponse);
    }

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

    setUsername(username: string): Promise<SetUsernameResponse> {
        return this.handleResponse(
            this.userService.set_username({
                username: username,
            }),
            setUsernameResponse
        );
    }

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

    confirmPhoneNumber(code: string): Promise<ConfirmPhoneNumberResponse> {
        return this.handleResponse(
            this.userService.confirm_phone_number({
                confirmation_code: code,
            }),
            confirmPhoneNumber
        );
    }
}
