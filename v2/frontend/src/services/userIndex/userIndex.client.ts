import type { Identity } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { idlFactory, UserIndexService } from "./candid/idl";
import type {
    ConfirmPhoneNumberResponse,
    CurrentUserResponse,
    SubmitPhoneNumberResponse,
    SetUsernameResponse,
    PhoneNumber,
    ResendCodeResponse,
    UsersArgs,
    UsersResponse,
    UserSummary,
    UpgradeCanisterResponse,
    CreateCanisterResponse,
    RegistrationFeeResponse,
    FeeCurrency,
    NotificationFeePaidResponse,
    RegisterUserResponse,
    UpgradeStorageResponse,
    RefreshAccountBalanceResponse,
} from "../../domain/user/user";
import { CandidService } from "../candidService";
import {
    setUsernameResponse,
    currentUserResponse,
    submitPhoneNumberResponse,
    confirmPhoneNumber,
    resendCodeResponse,
    usersResponse,
    userSearchResponse,
    upgradeCanisterResponse,
    createCanisterResponse,
    generateRegistrationFeeResponse,
    feePaidResponse,
    registerUserResponse,
    upgradeStorageResponse,
    refreshAccountBalanceResponse,
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

    searchUsers(searchTerm: string, maxResults = 20): Promise<UserSummary[]> {
        return this.handleResponse(
            this.userService.search({
                search_term: searchTerm,
                max_results: maxResults,
            }),
            userSearchResponse
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
        return this.handleResponse(
            this.userService.users({
                user_groups: userGroups.map(({ users, updatedSince }) => ({
                    users: users.map((u) => Principal.fromText(u)),
                    updated_since: updatedSince,
                })),
            }),
            usersResponse
        );
    }

    upgradeUser(): Promise<UpgradeCanisterResponse> {
        return this.handleResponse(this.userService.upgrade_canister({}), upgradeCanisterResponse);
    }

    createCanister(): Promise<CreateCanisterResponse> {
        return this.handleResponse(this.userService.create_canister({}), createCanisterResponse);
    }

    getCurrentUser(): Promise<CurrentUserResponse> {
        return this.handleResponse(this.userService.current_user({}), currentUserResponse);
    }

    notifyRegistrationFeePaid(): Promise<NotificationFeePaidResponse> {
        return this.handleResponse(
            this.userService.notify_registration_fee_paid({}),
            feePaidResponse
        );
    }

    upgradeStorage(newLimitBytes: number): Promise<UpgradeStorageResponse> {
        return this.handleResponse(
            this.userService.upgrade_storage({
                new_storage_limit_bytes: BigInt(newLimitBytes),
            }),
            upgradeStorageResponse
        );
    }

    refreshBalance(): Promise<RefreshAccountBalanceResponse> {
        return this.handleResponse(
            this.userService.refresh_account_balance({}),
            refreshAccountBalanceResponse
        );
    }

    generateRegistrationFee(currency: FeeCurrency): Promise<RegistrationFeeResponse> {
        return this.handleResponse(
            this.userService.generate_registration_fee({
                currency: currency === "cycles" ? { Cycles: null } : { ICP: null },
            }),
            generateRegistrationFeeResponse
        );
    }

    resendRegistrationCode(): Promise<ResendCodeResponse> {
        return this.handleResponse(this.userService.resend_code({}), resendCodeResponse);
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

    registerUser(username: string): Promise<RegisterUserResponse> {
        return this.handleResponse(
            this.userService.register_user({
                username,
            }),
            registerUserResponse
        );
    }
}
