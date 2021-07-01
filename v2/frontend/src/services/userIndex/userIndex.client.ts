import type { Identity } from "@dfinity/agent";
import idlFactory, { UserIndexService } from "api-canisters/user_index/src/canister/app/idl";
import type {
    ConfirmPhoneNumberResponse,
    CurrentUserResponse,
    SubmitPhoneNumberResponse,
    SetUsernameResponse,
    PhoneNumber,
    ResendCodeResponse,
} from "../../domain/user";
import { identity } from "../../utils/mapping";
import { CandidService } from "../candidService";
import {
    setUsernameResponse,
    currentUserResponse,
    submitPhoneNumberResponse,
    confirmPhoneNumber,
    resendCodeResponse,
} from "./mappers";
import type { IUserIndexClient } from "./userIndex.client.interface";

export class UserIndexClient extends CandidService implements IUserIndexClient {
    private userService: UserIndexService;

    constructor(identity: Identity) {
        super(identity);
        this.userService = this.createServiceClient<UserIndexService>(
            idlFactory,
            "user_index_canister_id" // todo - where does this come from
        );
    }

    upgradeUser(): Promise<void> {
        return this.handleResponse(this.userService.upgrade_canister({}), identity);
    }

    createCanister(): Promise<void> {
        return this.handleResponse(this.userService.create_canister({}), identity);
    }

    getCurrentUser(): Promise<CurrentUserResponse> {
        return this.handleResponse(this.userService.current_user({}), currentUserResponse);
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
                number: {
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
