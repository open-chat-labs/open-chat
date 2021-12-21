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
    UsersResponse,
    UserSummary,
    UpgradeCanisterResponse,
    CreateCanisterResponse,
    RegistrationFeeResponse,
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
} from "./mappers";
import type { IUserIndexClient } from "./userIndex.client.interface";

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

    static create(identity: Identity): IUserIndexClient {
        return new UserIndexClient(identity);
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

    getUsers(userIds: string[], since: bigint): Promise<UsersResponse> {
        if (userIds.length === 0) {
            return Promise.resolve({
                timestamp: BigInt(Date.now()),
                users: [],
            });
        }
        return this.handleResponse(
            this.userService.users({
                users: userIds.map((u) => {
                    return Principal.fromText(u);
                }),
                updated_since: [since],
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

    generateRegistrationFee(): Promise<RegistrationFeeResponse> {
        return this.handleResponse(
            this.userService.generate_registration_fee({}),
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
}
