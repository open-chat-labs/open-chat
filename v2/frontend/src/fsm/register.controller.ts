// export interface RegisterContext {
//     currentUser?: CurrentUserResponse;
//     serviceContainer?: ServiceContainer;
//     error?: Error;
//     phoneNumber?: PhoneNumber;
//     registrationCode?: string;
//     userCanister?: Principal;
//     username?: string;
// }

import { Writable, writable } from "svelte/store";
import type { CurrentUserResponse, PhoneNumber } from "../domain/user/user";
import type { ServiceContainer } from "../services/serviceContainer";

export type RegisterState =
    | "awaiting_phone_number"
    | "awaiting_code"
    | "verifying"
    | "awaiting_username"
    | "awaiting_completion"
    | "awaiting_canister";

export class RegisterController {
    public state: Writable<RegisterState> = writable("awaiting_phone_number");
    public error: Writable<string | undefined> = writable(undefined);
    public username: Writable<string | undefined> = writable(undefined);
    public phoneNumber: Writable<PhoneNumber | undefined> = writable(undefined);

    constructor(
        private _api: ServiceContainer,
        private currentUser: CurrentUserResponse,
        private _onComplete: (user: CurrentUserResponse) => void,
        private _phoneNumber?: PhoneNumber
    ) {
        this.phoneNumber = writable(_phoneNumber);
        if (currentUser.kind === "unknown_user") {
            this.state.set("awaiting_phone_number");
        } else if (currentUser.kind === "unconfirmed_user") {
            this.state.set("awaiting_code");
        } else if (currentUser.kind === "confirmed_pending_username") {
            this.state.set("awaiting_username");
        } else if (currentUser.kind === "confirmed_user") {
            if (currentUser.canisterCreationStatus === "in_progress") {
                this.state.set("awaiting_canister");
            } else if (currentUser.canisterCreationStatus === "pending") {
                this.state.set("awaiting_canister");
                this.loadUser();
            }
        }
    }

    submitRegistrationCode(code: string): void {
        this.state.set("verifying");
        this._api.confirmPhoneNumber(code).then((resp) => {
            this.state.set("awaiting_code");
            if (resp === "already_claimed") {
                this.error.set("register.confirmAlreadyClaimed");
            } else if (resp === "code_expired") {
                this.error.set("register.codeExpired");
            } else if (resp === "code_incorrect") {
                this.error.set("register.codeIncorrect");
            } else if (resp === "not_found") {
                this.error.set("register.codeNotFound");
            } else if (resp === "success") {
                this.error.set(undefined);
                this.state.set("awaiting_username");
            }
        });
    }

    changePhoneNumber(): void {
        this.state.set("awaiting_phone_number");
    }

    requestRegistrationCode(phoneNumber: PhoneNumber): void {
        this.phoneNumber.set(phoneNumber);
        this.state.set("verifying");
        this._api.submitPhoneNumber(phoneNumber).then((resp) => {
            this.state.set("awaiting_phone_number");
            if (resp.kind === "already_registered") {
                this.error.set("register.phoneAlreadyRegistered");
            } else if (resp.kind === "already_registered_by_other") {
                this.error.set("register.phoneAlreadyRegisteredByAnother");
            } else if (resp.kind === "invalid_phone_number") {
                this.error.set("register.phoneInvalid");
            } else if (resp.kind === "user_limit_reached") {
                this.error.set("register.userLimitReached");
            } else if (resp.kind === "success") {
                this.error.set(undefined);
                this.state.set("awaiting_code");
            }
        });
    }

    registerUser(username: string): void {
        this.state.set("verifying");
        this.username.set(username);
        this._api.setUsername(username).then((resp) => {
            this.state.set("awaiting_username");
            if (resp === "username_taken") {
                this.error.set("register.usernameTaken");
            } else if (resp === "user_not_found") {
                this.error.set("register.userNotFound");
            } else if (resp === "username_too_short") {
                this.error.set("register.usernameTooShort");
            } else if (resp === "username_too_long") {
                this.error.set("register.usernameTooLong");
            } else if (resp === "username_invalid") {
                this.error.set("register.usernameInvalid");
            } else if (resp === "success") {
                this.error.set(undefined);
                this.state.set("awaiting_canister");
                this.loadUser();
            }
        });
    }

    private loadUser() {
        this._api.getCurrentUser().then((resp) => {
            if (
                (resp.kind === "confirmed_user" || resp.kind === "confirmed_pending_username") &&
                resp.canisterCreationStatus === "pending"
            ) {
                this._api.createCanister().then((canisterResp) => {
                    if (canisterResp !== "success") {
                        console.log("Create use canister failed: ", canisterResp);
                    }
                    this.loadUser();
                });
            } else if (resp.kind === "created_user") {
                this.state.set("awaiting_completion");
                this.currentUser = resp;
            }
        });
    }

    complete(): void {
        this._onComplete(this.currentUser);
    }

    resendRegistrationCode(): void {
        this.state.set("verifying");
        this._api.resendRegistrationCode().then((resp) => {
            if (resp === "already_claimed") {
                this.error.set("register.resendAlreadyClaimed");
            } else if (resp === "user_not_found") {
                this.error.set("register.userNotFound");
            } else {
                this.error.set(undefined);
            }
            this.state.set("awaiting_code");
        });
    }
}
